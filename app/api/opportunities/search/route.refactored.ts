/**
 * Refactored Opportunities Search API Route
 * Using new architecture patterns
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { OpportunityService } from '@/core/contracts/services/OpportunityService'
import { OpportunityRepository } from '@/core/contracts/repositories/OpportunityRepository'
import { CacheService } from '@/infrastructure/cache/CacheService'
import { PerformanceMonitor } from '@/infrastructure/monitoring/performance'
import { logger } from '@/infrastructure/monitoring/logger'
import { createRedisClient } from '@/infrastructure/database/redis/client'
import { UnauthorizedError, ValidationError } from '@/shared/types/errors'

// Query validation schema
const searchQuerySchema = z.object({
  q: z.string().optional(),
  naics: z.string().optional(),
  state: z.string().length(2).optional(),
  active: z.string().transform(val => val === 'true').optional(),
  minValue: z.string().transform(Number).optional(),
  maxValue: z.string().transform(Number).optional(),
  deadlineFrom: z.string().optional(),
  deadlineTo: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('25'),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default('0')
})

export async function GET(request: NextRequest) {
  const requestLogger = logger.child({ 
    route: 'GET /api/opportunities/search',
    requestId: crypto.randomUUID()
  })

  return PerformanceMonitor.track('api:opportunities:search', async () => {
    try {
      // Auth check
      const supabase = await createServerClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new UnauthorizedError('Authentication required')
      }

      // Parse query parameters
      const { searchParams } = new URL(request.url)
      const queryData = Object.fromEntries(searchParams)
      
      const validatedQuery = searchQuerySchema.safeParse(queryData)
      if (!validatedQuery.success) {
        throw new ValidationError('Invalid query parameters', validatedQuery.error)
      }

      const filters = {
        searchQuery: validatedQuery.data.q,
        naicsCodes: validatedQuery.data.naics?.split(',').filter(Boolean),
        state: validatedQuery.data.state,
        active: validatedQuery.data.active,
        minValue: validatedQuery.data.minValue,
        maxValue: validatedQuery.data.maxValue,
        deadlineFrom: validatedQuery.data.deadlineFrom 
          ? new Date(validatedQuery.data.deadlineFrom) 
          : undefined,
        deadlineTo: validatedQuery.data.deadlineTo 
          ? new Date(validatedQuery.data.deadlineTo) 
          : undefined,
        limit: validatedQuery.data.limit,
        offset: validatedQuery.data.offset
      }

      // Get user's company profile
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          company_id,
          companies!inner(*)
        `)
        .eq('id', user.id)
        .single()

      const companyProfile = profile?.companies 
        ? CompanyProfile.fromDatabase(profile.companies)
        : undefined

      // Initialize services
      const redis = await createRedisClient()
      const cache = new CacheService(redis, 'mch:')
      const repository = new OpportunityRepository(supabase)
      const service = new OpportunityService(repository, cache)

      // Search opportunities
      const result = await service.searchOpportunities(filters, companyProfile)

      requestLogger.info('Opportunities search completed', {
        userId: user.id,
        filters,
        resultCount: result.opportunities.length,
        totalCount: result.totalCount
      })

      return NextResponse.json({
        opportunities: result.opportunities.map(opp => opp.toJSON()),
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        nextOffset: result.nextOffset,
        filters
      })

    } catch (error) {
      requestLogger.error('Opportunities search failed', error)
      
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        )
      }
      
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { error: error.message, details: error.details },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}