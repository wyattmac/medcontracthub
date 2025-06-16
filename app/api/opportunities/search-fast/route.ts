/**
 * Fast Opportunities Search API - Optimized for Speed
 * Target: <500ms response times with real data
 * Uses enhanced route handler and minimal processing
 */

import { NextResponse } from 'next/server'
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'
import { calculateOpportunityMatch } from '@/lib/sam-gov/utils'

export const GET = enhancedRouteHandler.GET(
  async ({ user, supabase }, request) => {
    const startTime = Date.now()
    
    // Extract and validate parameters from URL
    const url = new URL(request.url)
    const searchParams = url.searchParams
    
    const searchQuery = searchParams.get('q') || ''
    const limitParam = searchParams.get('limit') || '25'
    const offsetParam = searchParams.get('offset') || '0'
    const naics = searchParams.get('naics') || ''
    const state = searchParams.get('state') || ''
    const status = searchParams.get('status') || 'active'

    const limit = Math.min(parseInt(limitParam), 100)
    const offset = parseInt(offsetParam)

    try {
      // Step 1: Get user's NAICS codes for matching (if authenticated)
      let userNaicsCodes: string[] = []
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select(`
            company_id,
            companies!inner(naics_codes)
          `)
          .eq('id', user.id)
          .single()

        userNaicsCodes = profile?.companies?.naics_codes || []
      }

      // Use default medical NAICS codes if no user or user has no codes
      if (userNaicsCodes.length === 0) {
        userNaicsCodes = ['423450', '339112', '621999'] // Medical equipment, devices, healthcare
      }

      // Step 2: Try to use the optimized RPC function first
      let opportunities: any[] = []
      let count = 0
      let error: any = null

      // First, try the optimized database function
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('search_opportunities_fast', {
          search_query: searchQuery,
          status_filter: status === 'active' ? 'active' : null,
          naics_filter: naics || null,
          state_filter: state || null,
          user_naics_codes: userNaicsCodes,
          user_id: user?.id || null,
          sort_by: 'relevance',
          limit_count: limit,
          offset_count: offset
        })

        if (!rpcError && rpcData) {
          // RPC function returns pre-processed data with match scores
          opportunities = rpcData
          count = rpcData.length // Note: This is not exact count, but good enough
          
          // Get exact count separately if needed
          const { count: exactCount } = await supabase
            .from('opportunities')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
          
          count = exactCount || count
        } else {
          throw new Error('RPC function not available, falling back to regular query')
        }
      } catch (rpcErr) {
        // Fallback to regular query if RPC fails
        console.log('Using fallback query method')
        
        let query = supabase
          .from('opportunities')
          .select(`
            *
          `, { count: 'exact' })

        // Apply pagination
        query = query.range(offset, offset + limit - 1)

        // Apply filters
        if (status === 'active') {
          query = query.eq('status', 'active')
        }

        // Text search across multiple fields
        if (searchQuery.trim()) {
          query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,agency.ilike.%${searchQuery}%`)
        }

        // NAICS filter
        if (naics) {
          const naicsArray = naics.split(',').filter(Boolean)
          if (naicsArray.length > 0) {
            query = query.in('naics_code', naicsArray)
          }
        }

        // State filter
        if (state) {
          query = query.eq('place_of_performance_state', state)
        }

        // Sort by posted date (newest first) for consistent results
        query = query.order('posted_date', { ascending: false })

        // Execute query
        const result = await query
        opportunities = result.data || []
        count = result.count || 0
        error = result.error
      }

      if (error) {
        console.error('Database error:', error)
        throw new Error('Database query failed')
      }

      // Step 4: Process results efficiently
      const processedOpportunities = (opportunities || []).map(opp => {
        // If data comes from RPC, it already has match_score and is_saved
        if (opp.match_score !== undefined) {
          return {
            ...opp,
            matchScore: opp.match_score,
            isSaved: opp.is_saved || false
          }
        }
        
        // Otherwise, calculate match score for fallback query
        const matchScore = calculateOpportunityMatch(opp, userNaicsCodes)
        
        // Check if saved by current user
        const isSaved = user && opp.saved_opportunities?.some(
          (saved: any) => saved.user_id === user.id
        )

        // Clean up response
        const { saved_opportunities, ...cleanOpp } = opp

        return {
          ...cleanOpp,
          matchScore,
          isSaved: !!isSaved
        }
      })

      // Step 5: Sort by relevance (match score + recency) - skip if from RPC (already sorted)
      if (!opportunities[0]?.match_score) {
        processedOpportunities.sort((a, b) => {
          // Primary: match score (higher is better)
          if (a.matchScore !== b.matchScore) {
            return b.matchScore - a.matchScore
          }
          // Secondary: posted date (newer is better)
          return new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime()
        })
      }

      const totalTime = Date.now() - startTime

      // Step 6: Return response
      return NextResponse.json({
        opportunities: processedOpportunities,
        totalCount: count || 0,
        hasMore: offset + limit < (count || 0),
        quotaStatus: {
          remaining: 756,
          total: 1000,
          warningThreshold: 200
        },
        performance: {
          queryTime: totalTime,
          userNaicsCount: userNaicsCodes.length,
          resultsCount: processedOpportunities.length
        }
      })

    } catch (error) {
      const totalTime = Date.now() - startTime
      console.error('Search API error:', error)
      
      return NextResponse.json({
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        performance: { queryTime: totalTime }
      }, { status: 500 })
    }
  },
  {
    requireAuth: process.env.NODE_ENV !== 'development', // Allow unauthenticated in dev
    rateLimit: 'api'
  }
)