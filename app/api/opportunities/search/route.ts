/**
 * API Route: Search opportunities
 * GET /api/opportunities/search
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler, IRouteContext } from '@/lib/api/route-handler-next15'
import { getOpportunitiesFromDatabase, calculateOpportunityMatch } from '@/lib/sam-gov/utils'
import { DatabaseError, NotFoundError } from '@/lib/errors/types'
import { dbLogger } from '@/lib/errors/logger'
import { searchCache, createCacheKey } from '@/lib/utils/cache'
import { getSAMQuotaManager } from '@/lib/sam-gov/quota-manager'
import { 
  stateSchema, 
  opportunityStatusSchema, 
  dateSchema, 
  limitSchema, 
  offsetSchema 
} from '@/lib/validation/shared-schemas'

// Query validation schema using shared schemas
const searchQuerySchema = z.object({
  q: z.string().optional(),
  naics: z.string().optional(),
  state: stateSchema.optional(),
  status: opportunityStatusSchema.optional(),
  deadline_from: dateSchema.optional(),
  deadline_to: dateSchema.optional(),
  limit: limitSchema,
  offset: offsetSchema
}).refine((data) => {
  // If both deadline dates are provided, ensure 'to' is after 'from'
  if (data.deadline_from && data.deadline_to) {
    return new Date(data.deadline_to) >= new Date(data.deadline_from)
  }
  return true
}, {
  message: 'Deadline end date must be after or equal to start date',
  path: ['deadline_to']
})

export const GET = routeHandler.GET(
  async ({ request, user, supabase }: IRouteContext) => {
    const { searchParams } = new URL(request.url)
    
    // Parse and validate query parameters
    const queryData = Object.fromEntries(searchParams)
    const validatedQuery = searchQuerySchema.parse(queryData)
    
    // Build filters - convert 'all' values back to undefined
    const filters = {
      searchQuery: validatedQuery.q || undefined,
      naicsCodes: validatedQuery.naics && validatedQuery.naics !== 'all' 
        ? validatedQuery.naics.split(',').filter(Boolean) 
        : undefined,
      state: validatedQuery.state && validatedQuery.state !== 'all' 
        ? validatedQuery.state 
        : undefined,
      status: validatedQuery.status,
      responseDeadlineFrom: validatedQuery.deadline_from || undefined,
      responseDeadlineTo: validatedQuery.deadline_to || undefined,
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

    // Check SAM.gov quota status
    const quotaManager = getSAMQuotaManager()
    const quotaStatus = await quotaManager.getQuotaStatus()
    
    // Create cache key for this search
    const cacheKey = createCacheKey('search', {
      ...enhancedFilters,
      userId: user.id
    })
    
    // Check cache first - more aggressive caching when quota is low
    const shouldExtendCache = quotaStatus.daily.remaining < 200
    const cachedResult = searchCache.getWithStats<{
      opportunities: any[]
      count: number
    }>(cacheKey)

    if (cachedResult) {
      dbLogger.debug('Cache hit for search', { 
        cacheKey, 
        quotaRemaining: quotaStatus.daily.remaining 
      })
      return NextResponse.json({
        opportunities: cachedResult.opportunities,
        totalCount: cachedResult.count,
        hasMore: (enhancedFilters.offset + enhancedFilters.limit) < cachedResult.count,
        quotaStatus: {
          remaining: quotaStatus.daily.remaining,
          total: quotaStatus.daily.used + quotaStatus.daily.remaining
        }
      })
    }

    // Search opportunities with optimized database sorting
    const { data: opportunities, error, count } = await getOpportunitiesFromDatabase(enhancedFilters)

    if (error) {
      dbLogger.error('Database search failed', error, { filters })
      throw new DatabaseError('Search failed', undefined, error)
    }

    // Enhance data with client-side match scores and saved status
    const enhancedOpportunities = (opportunities || []).map(opportunity => {
      const matchScore = calculateOpportunityMatch(opportunity, companyNaicsCodes)
      
      return {
        ...opportunity,
        matchScore,
        isSaved: opportunity.saved_opportunities?.length > 0
      }
    })
    
    // Sort by match score (highest first), then by deadline
    .sort((a, b) => {
      // First sort by match score (descending)
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore
      }
      // Then by deadline (ascending - soonest first)
      return new Date(a.response_deadline).getTime() - new Date(b.response_deadline).getTime()
    })

    // Cache the results - extend TTL when quota is low
    const cacheTTL = shouldExtendCache ? 1800 : 300 // 30 minutes vs 5 minutes
    searchCache.set(cacheKey, {
      opportunities: enhancedOpportunities,
      count: count || 0
    }, cacheTTL)

    // Log search activity - commented out as log_audit RPC may not exist
    // TODO: Implement audit logging when the database function is available
    /*
    if (filters.searchQuery || filters.naicsCodes) {
      try {
        await supabase.rpc('log_audit', {
          p_action: 'search_opportunities',
          p_entity_type: 'opportunities',
          p_changes: { filters, resultCount: enhancedOpportunities.length }
        })
      } catch (error) {
        dbLogger.warn('Failed to log search activity', error)
      }
    }
    */

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
      },
      quotaStatus: {
        remaining: quotaStatus.daily.remaining,
        total: quotaStatus.daily.used + quotaStatus.daily.remaining,
        warningThreshold: 200
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