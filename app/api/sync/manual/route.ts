/**
 * API Route: Manual sync trigger
 * POST /api/sync/manual
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'
import { SAMApiClient } from '@/lib/sam-gov/client'
import { syncOpportunitiesToDatabase } from '@/lib/sam-gov/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    
    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { limit = 50, naicsFilter } = await request.json()

    console.log(`Manual sync triggered by user ${user.id}`, { limit, naicsFilter })

    // Log sync start
    await supabase.rpc('log_audit', {
      p_action: 'manual_sync_started',
      p_entity_type: 'opportunities',
      p_changes: { limit, naicsFilter, triggered_by: user.id }
    })

    // Initialize SAM.gov API client
    const samClient = new SAMApiClient()

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
    samParams.postedFrom = threeDaysAgo.toISOString().split('T')[0]

    // Fetch opportunities from SAM.gov
    const response = await samClient.getOpportunities(samParams)
    
    if (!response.opportunities || response.opportunities.length === 0) {
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

    console.log(`Manual sync fetched ${response.opportunities.length} opportunities`)

    // Sync to database
    const syncResult = await syncOpportunitiesToDatabase(response.opportunities)

    // Log sync completion
    await supabase.rpc('log_audit', {
      p_action: 'manual_sync',
      p_entity_type: 'opportunities',
      p_changes: {
        fetched: response.opportunities.length,
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
        fetched: response.opportunities.length,
        inserted: syncResult.inserted,
        updated: syncResult.updated,
        errors: syncResult.errors
      }
    })

  } catch (error) {
    console.error('Manual sync error:', error)

    // Log sync failure
    try {
      const supabase = createServerComponentClient<Database>({ cookies })
      const { data: { user } } = await supabase.auth.getUser()
      
      await supabase.rpc('log_audit', {
        p_action: 'manual_sync_failed',
        p_entity_type: 'opportunities',
        p_changes: {
          error: error instanceof Error ? error.message : 'Unknown error',
          triggered_by: user?.id
        }
      })
    } catch (logError) {
      console.error('Failed to log manual sync error:', logError)
    }

    return NextResponse.json(
      { 
        error: 'Manual sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}