/**
 * API Route: Search opportunities
 * GET /api/opportunities/search
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler, IRouteContext } from '@/lib/api/route-handler'
import { getOpportunitiesFromDatabase, calculateOpportunityMatch } from '@/lib/sam-gov/utils'
import { DatabaseError, NotFoundError } from '@/lib/errors/types'
import { dbLogger } from '@/lib/errors/logger'
import { searchCache, createCacheKey } from '@/lib/utils/cache'

// Query validation schema
const searchQuerySchema = z.object({
  q: z.string().optional(),
  naics: z.string().optional(),
  state: z.string().length(2).optional(),
  status: z.enum(['active', 'awarded', 'cancelled', 'expired']).optional(),
  deadline_from: z.string().datetime().optional(),
  deadline_to: z.string().datetime().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('25'),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default('0')
})

export const GET = routeHandler.GET(
  async ({ request, user, supabase }: IRouteContext) => {
    const { searchParams } = new URL(request.url)
    
    // Parse and validate query parameters
    const queryData = Object.fromEntries(searchParams)
    const validatedQuery = searchQuerySchema.parse(queryData)
    
    // Build filters
    const filters = {
      searchQuery: validatedQuery.q,
      naicsCodes: validatedQuery.naics?.split(',').filter(Boolean),
      state: validatedQuery.state,
      status: validatedQuery.status,
      responseDeadlineFrom: validatedQuery.deadline_from,
      responseDeadlineTo: validatedQuery.deadline_to,
      limit: validatedQuery.limit,
      offset: validatedQuery.offset
    }

    // Get user's company NAICS codes for match scoring
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        company_id,
        companies!inner(naics_codes)
      `)
      .eq('id', user.id)
      .single()

    if (profileError) {
      dbLogger.error('Failed to fetch user profile', profileError)
      throw new DatabaseError('Failed to fetch user profile')
    }

    if (!profile?.company_id) {
      throw new NotFoundError('Company profile')
    }

    const companyNaicsCodes = (profile?.companies as any)?.naics_codes || []

    // If no specific NAICS filter and user has company NAICS codes, use those
    if (!filters.naicsCodes && companyNaicsCodes.length > 0) {
      filters.naicsCodes = companyNaicsCodes
    }

    // Pass company NAICS codes for optimized database sorting
    const enhancedFilters = {
      ...filters,
      companyNaicsCodes
    }

    // Create cache key for this search
    const cacheKey = createCacheKey('search', {
      ...enhancedFilters,
      userId: user.id
    })

    // Check cache first
    const cachedResult = searchCache.getWithStats<{
      opportunities: any[]
      count: number
    }>(cacheKey)

    if (cachedResult) {
      dbLogger.debug('Cache hit for search', { cacheKey })
      return NextResponse.json({
        opportunities: cachedResult.opportunities,
        total: cachedResult.count,
        page: Math.floor(validatedQuery.offset / validatedQuery.limit) + 1,
        pageSize: validatedQuery.limit
      })
    }

    // Search opportunities with optimized database sorting
    const { data: opportunities, error, count } = await getOpportunitiesFromDatabase(enhancedFilters)

    if (error) {
      dbLogger.error('Database search failed', error, { filters })
      throw new DatabaseError('Search failed', undefined, error)
    }

    // Enhance data with client-side match scores and saved status
    // The opportunities are already sorted by the database
    const enhancedOpportunities = (opportunities || []).map(opportunity => {
      const matchScore = calculateOpportunityMatch(opportunity, companyNaicsCodes)
      
      return {
        ...opportunity,
        matchScore,
        isSaved: opportunity.saved_opportunities?.length > 0
      }
    })

    // Cache the results for 5 minutes
    searchCache.set(cacheKey, {
      opportunities: enhancedOpportunities,
      count: count || 0
    }, 300) // 5 minutes TTL

    // Log search activity
    if (filters.searchQuery || filters.naicsCodes) {
      supabase.rpc('log_audit', {
        p_action: 'search_opportunities',
        p_entity_type: 'opportunities',
        p_changes: { filters, resultCount: enhancedOpportunities.length }
      }).catch((error: any) => {
        dbLogger.warn('Failed to log search activity', error)
      })
    }

    return NextResponse.json({
      opportunities: enhancedOpportunities,
      totalCount: count || 0,
      hasMore: (filters.offset + filters.limit) < (count || 0),
      nextOffset: enhancedOpportunities.length === filters.limit 
        ? filters.offset + filters.limit 
        : null,
      filters: {
        ...filters,
        naicsCodes: filters.naicsCodes || []
      }
    })
  },
  {
    requireAuth: true,
    validateQuery: searchQuerySchema,
    rateLimit: 'search',
    sanitization: {
      // Search queries need special sanitization
      body: {
        q: 'search',
        title: 'text',
        description: 'text'
      }
    }
  }
)