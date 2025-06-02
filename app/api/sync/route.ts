/**
 * API Route: Sync opportunities from SAM.gov
 * POST /api/sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { SAMApiClient } from '@/lib/sam-gov/client'
import { syncOpportunitiesToDatabase } from '@/lib/sam-gov/utils'

// Use service role for background operations
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Set a reasonable timeout for sync operations
    const syncTimeout = 5 * 60 * 1000 // 5 minutes
    
    return await Promise.race([
      performSync(request),
      new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('Sync operation timeout - operation may continue in background')), syncTimeout)
      )
    ])
  } catch (error) {
    console.error('Sync error:', error)
    
    return NextResponse.json(
      { 
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function performSync(request: NextRequest) {
  try {
    // Verify authorization for sync operations
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.SYNC_TOKEN || 'default-sync-token'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const forceSync = searchParams.get('force') === 'true'
    const naicsFilter = searchParams.get('naics')
    const limit = parseInt(searchParams.get('limit') || '100')

    console.log('Starting opportunity sync...', { forceSync, naicsFilter, limit })

    // Initialize SAM.gov API client
    const samClient = new SAMApiClient()

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
      
      if (!response.opportunities || response.opportunities.length === 0) {
        break
      }

      allOpportunities = allOpportunities.concat(response.opportunities)
      totalFetched += response.opportunities.length
      
      console.log(`Fetched page ${page + 1}: ${response.opportunities.length} opportunities`)

      // Check if we have more pages
      if (response.opportunities.length < samParams.limit) {
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
    await supabase
      .from('audit_logs')
      .insert({
        user_id: null, // System operation
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
      await supabase
        .from('audit_logs')
        .insert({
          user_id: null,
          action: 'sync_failed',
          entity_type: 'opportunities',
          changes: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
    } catch (logError) {
      console.error('Failed to log sync error:', logError)
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