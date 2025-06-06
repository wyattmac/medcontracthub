/**
 * API Route: Manual sync trigger
 * POST /api/sync/manual
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler'
import { getSAMApiClient } from '@/lib/sam-gov'
import { syncOpportunitiesToDatabase } from '@/lib/sam-gov/utils'
import { DatabaseError } from '@/lib/errors/types'

// Request body validation schema
const manualSyncSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
  naicsFilter: z.string().optional()
})

export const POST = routeHandler.POST(
  async ({ user, supabase, sanitizedBody }) => {
    const { limit, naicsFilter } = sanitizedBody

    console.log(`Manual sync triggered by user ${user.id}`, { limit, naicsFilter })

    // Log sync start
    await supabase.rpc('log_audit', {
      p_action: 'manual_sync_started',
      p_entity_type: 'opportunities',
      p_changes: { limit, naicsFilter, triggered_by: user.id }
    })

    // Use the default SAM.gov API client
    const samClient = getSAMApiClient()

    // Build search parameters for recent active opportunities
    const samParams: any = {
      active: 'true',
      limit: Math.min(limit, 100), // Limit for manual sync
      offset: 0
    }

    // Add NAICS filter if specified
    if (naicsFilter) {
      samParams.naicsCode = naicsFilter
    }

    // Focus on recent opportunities (last 3 days)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    // Format date as MM/DD/YYYY (required by SAM.gov API)
    samParams.postedFrom = `${(threeDaysAgo.getMonth() + 1).toString().padStart(2, '0')}/${threeDaysAgo.getDate().toString().padStart(2, '0')}/${threeDaysAgo.getFullYear()}`

    // Fetch opportunities from SAM.gov
    const response = await samClient.getOpportunities(samParams)
    
    if (!response.opportunitiesData || response.opportunitiesData.length === 0) {
      await supabase.rpc('log_audit', {
        p_action: 'manual_sync',
        p_entity_type: 'opportunities',
        p_changes: {
          fetched: 0,
          inserted: 0,
          updated: 0,
          triggered_by: user.id,
          message: 'No new opportunities found'
        }
      })

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

    console.log(`Manual sync fetched ${response.opportunitiesData.length} opportunities`)

    // Sync to database
    const syncResult = await syncOpportunitiesToDatabase(response.opportunitiesData)

    // Log sync completion
    await supabase.rpc('log_audit', {
      p_action: 'manual_sync',
      p_entity_type: 'opportunities',
      p_changes: {
        fetched: response.opportunitiesData.length,
        inserted: syncResult.inserted,
        updated: syncResult.updated,
        errors: syncResult.errors.length,
        triggered_by: user.id,
        naics_filter: naicsFilter
      }
    })

    console.log('Manual sync completed:', syncResult)

    return NextResponse.json({
      success: true,
      message: `Manual sync completed: ${syncResult.inserted} new, ${syncResult.updated} updated`,
      stats: {
        fetched: response.opportunitiesData.length,
        inserted: syncResult.inserted,
        updated: syncResult.updated,
        errors: syncResult.errors
      }
    })
  },
  {
    requireAuth: true,
    validateBody: manualSyncSchema,
    rateLimit: 'sync'
  }
)