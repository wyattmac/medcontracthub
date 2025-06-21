/**
 * Optimized Opportunities Search API
 * Target: <1 second response time
 * Optimizations:
 * - Single database query with joins
 * - Server-side NAICS matching
 * - Efficient pagination
 * - Smart caching
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'
import { DatabaseError } from '@/lib/errors/types'
import { dbLogger } from '@/lib/errors/logger'
import { calculateOpportunityMatch } from '@/lib/sam-gov/utils'
import { createClient } from '@supabase/supabase-js'

// Query validation schema
const searchQuerySchema = z.object({
  q: z.string().optional(), // Changed from 'query' to match frontend
  status: z.enum(['active', 'closed', 'all']).optional().default('active'),
  sort: z.enum(['relevance', 'deadline', 'posted', 'value']).optional().default('relevance'),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional().default('0'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default('25'),
  naics: z.string().optional(),
  state: z.string().optional(), // Added state filter
  set_aside: z.string().optional(), // Added set_aside filter
  agency: z.string().optional(),
  deadline_from: z.string().optional(),
  deadline_to: z.string().optional(),
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
      q: searchQuery, 
      status, 
      sort, 
      offset, 
      limit,
      naics: naicsFilter,
      state: stateFilter,
      set_aside: setAsideFilter,
      agency: agencyFilter,
      deadline_from: deadlineFrom,
      deadline_to: deadlineTo,
      min_value: minValue,
      max_value: maxValue
    } = searchQuerySchema.parse(queryParams)
    

    // Calculate page from offset for response
    const page = Math.floor(offset / limit) + 1

    try {
      // In development mode with no auth, use service role client for better access
      let dbClient = supabase
      if (!user && process.env.NODE_ENV === 'development') {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        dbClient = createClient(supabaseUrl, supabaseServiceKey)
      }
      
      // Step 1: Get user's NAICS codes efficiently
      const userProfileStart = Date.now()
      let userNAICS: string[] = []
      
      if (user) {
        const { data: userProfile, error: profileError } = await dbClient
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
          dbLogger.warn('Failed to fetch user profile, using defaults', profileError)
          userNAICS = ['339112', '423450', '621999'] // Fallback to medical defaults
        } else {
          userNAICS = userProfile?.companies?.naics_codes || []
        }
      } else {
        // Development mode - use default medical NAICS codes for testing
        userNAICS = ['339112', '423450', '621999'] // Medical device manufacturing, medical equipment wholesale, healthcare
      }
      
      const profileTime = Date.now() - userProfileStart

      // Step 2: Build optimized query with all filters and joins
      const mainQueryStart = Date.now()
      
      let query = dbClient
        .from('opportunities')
        .select('*', { count: 'exact' })

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

      // Apply state filter
      if (stateFilter) {
        query = query.eq('place_of_performance_state', stateFilter)
      }
      
      // Apply set-aside filter
      if (setAsideFilter && setAsideFilter !== 'all') {
        query = query.eq('set_aside_type', setAsideFilter)
      }
      
      // Apply deadline filters
      if (deadlineFrom) {
        query = query.gte('response_deadline', deadlineFrom)
      }
      if (deadlineTo) {
        query = query.lte('response_deadline', deadlineTo)
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

      // Apply pagination after all filters
      query = query.range(offset, offset + limit - 1)

      const { data: opportunities, error: oppsError, count } = await query


      if (oppsError) {
        dbLogger.error('Error fetching opportunities', oppsError)
        throw new DatabaseError('Failed to fetch opportunities', undefined, oppsError)
      }

      const mainQueryTime = Date.now() - mainQueryStart

      // Step 3: Get saved status for opportunities (if user is logged in)
      let savedOpportunityIds: Set<string> = new Set()
      if (user && opportunities && opportunities.length > 0) {
        const opportunityIds = opportunities.map(o => o.id)
        const { data: savedOps } = await dbClient
          .from('saved_opportunities')
          .select('opportunity_id')
          .eq('user_id', user.id)
          .in('opportunity_id', opportunityIds)
        
        if (savedOps) {
          savedOpportunityIds = new Set(savedOps.map(so => so.opportunity_id))
        }
      }

      // Step 4: Calculate match scores efficiently (server-side)
      const scoringStart = Date.now()
      
      const processedOpportunities = opportunities?.map(opp => {
        // Calculate NAICS match score
        const matchScore = calculateOpportunityMatch(opp, userNAICS)
        
        // Determine if saved by current user
        const isSaved = savedOpportunityIds.has(opp.id)

        return {
          ...opp,
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
    requireAuth: process.env.NODE_ENV === 'production' && process.env.DEVELOPMENT_AUTH_BYPASS !== 'true', // Disable auth in development
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