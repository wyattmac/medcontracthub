/**
 * Optimized Opportunities Search API
 * Target: <1 second response time
 * Optimizations:
 * - Single database query with joins
 * - Server-side NAICS matching
 * - Efficient pagination
 * - Smart caching
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'
import { DatabaseError } from '@/lib/errors/types'
import { dbLogger } from '@/lib/errors/logger'
import { calculateOpportunityMatch } from '@/lib/sam-gov/utils'

// Query validation schema
const searchQuerySchema = z.object({
  query: z.string().optional(),
  status: z.enum(['active', 'closed', 'all']).default('active'),
  sort: z.enum(['relevance', 'deadline', 'posted', 'value']).default('relevance'),
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('25'),
  naics: z.string().optional(),
  agency: z.string().optional(),
  min_value: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  max_value: z.string().transform(Number).pipe(z.number().min(0)).optional()
})

export const GET = enhancedRouteHandler.GET(
  async ({ user, supabase }, request) => {
    const startTime = Date.now()
    
    // Parse query parameters
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const { 
      query: searchQuery, 
      status, 
      sort, 
      page, 
      limit,
      naics: naicsFilter,
      agency: agencyFilter,
      min_value: minValue,
      max_value: maxValue
    } = searchQuerySchema.parse(queryParams)

    const offset = (page - 1) * limit

    try {
      // Step 1: Get user's NAICS codes efficiently
      const userProfileStart = Date.now()
      let userNAICS: string[] = []
      
      if (user) {
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            company_id,
            companies!inner (
              naics_codes
            )
          `)
          .eq('id', user.id)
          .single()

        if (profileError) {
          dbLogger.error('Failed to fetch user profile', profileError)
          throw new DatabaseError('Failed to fetch user profile')
        }

        userNAICS = userProfile?.companies?.naics_codes || []
      } else {
        // Development mode - use default medical NAICS codes for testing
        userNAICS = ['339112', '423450', '621999'] // Medical device manufacturing, medical equipment wholesale, healthcare
      }
      
      const profileTime = Date.now() - userProfileStart

      // Step 2: Build optimized query with all filters and joins
      const mainQueryStart = Date.now()
      
      let query = supabase
        .from('opportunities')
        .select(`
          id,
          title,
          description,
          agency,
          solicitation_number,
          naics_code,
          posted_date,
          response_deadline,
          estimated_value_min,
          estimated_value_max,
          place_of_performance_state,
          place_of_performance_city,
          contract_type,
          status,
          created_at,
          updated_at,
          saved_opportunities!left (
            id,
            user_id
          )
        `, { count: 'exact' })
        .range(offset, offset + limit - 1)

      // Apply status filter
      if (status !== 'all') {
        query = query.eq('status', status)
      }

      // Apply text search (optimized with ILIKE on title/description)
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,agency.ilike.%${searchQuery}%,solicitation_number.ilike.%${searchQuery}%`)
      }

      // Apply NAICS filter
      if (naicsFilter) {
        query = query.eq('naics_code', naicsFilter)
      }

      // Apply agency filter
      if (agencyFilter) {
        query = query.ilike('agency', `%${agencyFilter}%`)
      }

      // Apply value range filters
      if (minValue !== undefined) {
        query = query.gte('estimated_value_min', minValue)
      }
      if (maxValue !== undefined) {
        query = query.lte('estimated_value_max', maxValue)
      }

      // Apply sorting
      switch (sort) {
        case 'deadline':
          query = query.order('response_deadline', { ascending: true, nullsLast: true })
          break
        case 'posted':
          query = query.order('posted_date', { ascending: false })
          break
        case 'value':
          query = query.order('estimated_value_max', { ascending: false, nullsLast: true })
          break
        case 'relevance':
        default:
          // For relevance, we'll sort by posted_date first, then apply NAICS scoring
          query = query.order('posted_date', { ascending: false })
          break
      }

      // Filter saved opportunities to current user only (if user exists)
      if (user) {
        query = query.or('saved_opportunities.user_id.is.null,saved_opportunities.user_id.eq.' + user.id)
      }

      const { data: opportunities, error: oppsError, count } = await query

      if (oppsError) {
        dbLogger.error('Error fetching opportunities', oppsError)
        throw new DatabaseError('Failed to fetch opportunities', undefined, oppsError)
      }

      const mainQueryTime = Date.now() - mainQueryStart

      // Step 3: Calculate match scores efficiently (server-side)
      const scoringStart = Date.now()
      
      const processedOpportunities = opportunities?.map(opp => {
        // Calculate NAICS match score
        const matchScore = calculateOpportunityMatch(opp, userNAICS)
        
        // Determine if saved by current user
        const isSaved = user ? opp.saved_opportunities?.some(
          (saved: any) => saved.user_id === user.id
        ) : false

        // Clean up the response
        const { saved_opportunities, ...cleanOpp } = opp

        return {
          ...cleanOpp,
          match_score: matchScore,
          is_saved: isSaved,
          // Add computed fields for better UX
          days_until_deadline: opp.response_deadline 
            ? Math.ceil((new Date(opp.response_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null,
          is_recently_posted: opp.posted_date 
            ? (Date.now() - new Date(opp.posted_date).getTime()) < (7 * 24 * 60 * 60 * 1000)
            : false
        }
      }) || []

      // Sort by relevance if requested (now that we have match scores)
      if (sort === 'relevance') {
        processedOpportunities.sort((a, b) => {
          // Primary sort: match score (descending)
          if (a.match_score !== b.match_score) {
            return b.match_score - a.match_score
          }
          // Secondary sort: posted date (newest first)
          return new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime()
        })
      }

      const scoringTime = Date.now() - scoringStart
      const totalTime = Date.now() - startTime

      // Performance metrics
      const performanceMetrics = {
        total_time: totalTime,
        profile_query: profileTime,
        main_query: mainQueryTime,
        scoring_time: scoringTime,
        opportunities_count: processedOpportunities.length,
        total_count: count || 0
      }

      // Log performance for monitoring
      if (totalTime > 1000) {
        dbLogger.warn('Slow opportunities query', { 
          ...performanceMetrics,
          user_id: user?.id,
          search_query: searchQuery,
          filters: { status, sort, naicsFilter, agencyFilter }
        })
      }

      return NextResponse.json({
        opportunities: processedOpportunities,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
          has_more: offset + limit < (count || 0)
        },
        filters: {
          status,
          sort,
          query: searchQuery,
          naics: naicsFilter,
          agency: agencyFilter,
          min_value: minValue,
          max_value: maxValue
        },
        performance: performanceMetrics,
        user_naics: userNAICS.length
      })

    } catch (error) {
      const totalTime = Date.now() - startTime
      dbLogger.error('Opportunities search failed', error, { 
        total_time: totalTime,
        user_id: user?.id 
      })
      
      if (error instanceof DatabaseError) {
        throw error
      }
      
      throw new DatabaseError('Search failed', undefined, error)
    }
  },
  {
    requireAuth: process.env.NODE_ENV !== 'development', // Disable auth in development
    validateQuery: searchQuerySchema,
    rateLimit: 'api'
  }
)

// Export types for frontend
export type OptimizedOpportunitySearchResponse = {
  opportunities: Array<{
    id: string
    title: string
    description: string
    agency: string
    solicitation_number: string
    naics_code: string
    posted_date: string
    response_deadline: string
    estimated_value_min: number
    estimated_value_max: number
    place_of_performance_state: string
    place_of_performance_city: string
    contract_type: string
    status: string
    match_score: number
    is_saved: boolean
    days_until_deadline: number | null
    is_recently_posted: boolean
    created_at: string
    updated_at: string
  }>
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    has_more: boolean
  }
  filters: {
    status: string
    sort: string
    query?: string
    naics?: string
    agency?: string
    min_value?: number
    max_value?: number
  }
  performance: {
    total_time: number
    profile_query: number
    main_query: number
    scoring_time: number
    opportunities_count: number
    total_count: number
  }
  user_naics: number
}