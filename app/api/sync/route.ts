/**
 * API Route: Sync opportunities from SAM.gov
 * POST /api/sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { getSAMApiClient } from '@/lib/sam-gov'
import { syncOpportunitiesToDatabase } from '@/lib/sam-gov/utils'
import { routeHandler, IRouteContext } from '@/lib/api/route-handler'
import { ExternalAPIError, DatabaseError } from '@/lib/errors/types'
import { syncLogger } from '@/lib/errors/logger'

// Use service role for background operations
const serviceSupabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Query validation schema
const syncQuerySchema = z.object({
  force: z.string().transform(val => val === 'true').optional(),
  naics: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).optional()
})

export const POST = routeHandler.POST(
  async ({ request, user, supabase }: IRouteContext) => {
    // Set a reasonable timeout for sync operations
    const syncTimeout = 5 * 60 * 1000 // 5 minutes
    
    try {
      return await Promise.race([
        performSync(request, user),
        new Promise<NextResponse>((_, reject) => 
          setTimeout(() => reject(new ExternalAPIError('SAM.gov API', 'Sync operation timeout - operation may continue in background')), syncTimeout)
        )
      ])
    } catch (error) {
      syncLogger.error('Sync operation failed', error as Error, {
        userId: user?.id,
        endpoint: '/api/sync'
      })

      if (error instanceof ExternalAPIError) {
        throw error
      }

      throw new ExternalAPIError('SAM.gov API', 'Sync operation failed', undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  },
  {
    requireAuth: true,
    validateQuery: syncQuerySchema,
    rateLimit: 'sync'
  }
)

async function performSync(request: NextRequest, user?: any): Promise<NextResponse> {
  const startTime = Date.now()
  let totalFetched = 0

  try {
    syncLogger.info('Starting sync operation', {
      userId: user?.id,
      timestamp: new Date().toISOString()
    })

    const { searchParams } = new URL(request.url)
    const forceSync = searchParams.get('force') === 'true'
    const naicsFilter = searchParams.get('naics')
    const limit = parseInt(searchParams.get('limit') || '100')

    console.log('Starting opportunity sync...', { forceSync, naicsFilter, limit })

    // Use the default SAM.gov API client
    const samClient = getSAMApiClient()

    // Build search parameters for active opportunities
    const samParams: any = {
      active: 'true',
      limit: Math.min(limit, 1000), // SAM.gov API limit
      offset: 0
    }

    // Add NAICS filter if specified
    if (naicsFilter) {
      samParams.naicsCode = naicsFilter
    }

    // Only sync recent opportunities unless force sync
    if (!forceSync) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      samParams.postedFrom = yesterday.toISOString().split('T')[0]
    }

    // Fetch opportunities from SAM.gov
    let allOpportunities: any[] = []
    let totalFetched = 0
    let currentOffset = 0
    const maxPages = 10 // Limit to prevent excessive API calls

    for (let page = 0; page < maxPages; page++) {
      samParams.offset = currentOffset

      const response = await samClient.getOpportunities(samParams)
      
      if (!response.opportunitiesData || response.opportunitiesData.length === 0) {
        break
      }

      allOpportunities = allOpportunities.concat(response.opportunitiesData)
      totalFetched += response.opportunitiesData.length
      
      console.log(`Fetched page ${page + 1}: ${response.opportunitiesData.length} opportunities`)

      // Check if we have more pages
      if (response.opportunitiesData.length < samParams.limit) {
        break
      }

      currentOffset += samParams.limit
    }

    console.log(`Total opportunities fetched: ${totalFetched}`)

    if (allOpportunities.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new opportunities found',
        stats: {
          fetched: 0,
          inserted: 0,
          updated: 0,
          errors: []
        }
      })
    }

    // Sync to database
    const syncResult = await syncOpportunitiesToDatabase(allOpportunities)

    // Log sync activity
    await serviceSupabase
      .from('audit_logs')
      .insert({
        user_id: user?.id || null,
        action: 'automated_sync',
        entity_type: 'opportunities',
        changes: {
          fetched: totalFetched,
          inserted: syncResult.inserted,
          updated: syncResult.updated,
          errors: syncResult.errors.length,
          naics_filter: naicsFilter,
          force_sync: forceSync
        }
      })

    console.log('Sync completed:', syncResult)

    return NextResponse.json({
      success: true,
      message: `Sync completed: ${syncResult.inserted} new, ${syncResult.updated} updated`,
      stats: {
        fetched: totalFetched,
        inserted: syncResult.inserted,
        updated: syncResult.updated,
        errors: syncResult.errors
      }
    })

  } catch (error) {
    console.error('Sync error:', error)

    // Log sync failure
    try {
      await serviceSupabase
        .from('audit_logs')
        .insert({
          user_id: user?.id || null,
          action: 'sync_failed',
          entity_type: 'opportunities',
          changes: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
    } catch (logError) {
      syncLogger.warn('Failed to log sync error to database', logError as Error)
    }

    return NextResponse.json(
      { 
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}