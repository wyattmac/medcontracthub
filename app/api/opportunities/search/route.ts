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

    // Search opportunities
    const { data: opportunities, error, count } = await getOpportunitiesFromDatabase(filters)

    if (error) {
      dbLogger.error('Database search failed', error, { filters })
      throw new DatabaseError('Search failed', undefined, error)
    }

    // Calculate match scores and enhance data
    const enhancedOpportunities = (opportunities || []).map(opportunity => {
      const matchScore = calculateOpportunityMatch(opportunity, companyNaicsCodes)
      
      return {
        ...opportunity,
        matchScore,
        isSaved: opportunity.saved_opportunities?.length > 0
      }
    })

    // Sort by match score (highest first) then by response deadline
    enhancedOpportunities.sort((a, b) => {
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore
      }
      return new Date(a.response_deadline).getTime() - new Date(b.response_deadline).getTime()
    })

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
    rateLimit: 'search'
  }
)