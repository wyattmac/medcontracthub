/**
 * API Route: Sync opportunities from SAM.gov
 * POST /api/opportunities/sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { samApiClient } from '@/lib/sam-gov'
import { syncOpportunitiesToDatabase } from '@/lib/sam-gov/utils'
import { Database } from '@/types/database.types'

interface ISyncRequest {
  naicsCodes?: string[]
  limit?: number
  forceRefresh?: boolean
}

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

    // Check if user has admin role or if this is their first sync
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const body: ISyncRequest = await request.json()
    const { naicsCodes, limit = 100, forceRefresh = false } = body

    // If no NAICS codes provided, get them from user's company
    let targetNaicsCodes = naicsCodes
    if (!targetNaicsCodes && profile.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('naics_codes')
        .eq('id', profile.company_id)
        .single()
      
      targetNaicsCodes = company?.naics_codes || []
    }

    if (!targetNaicsCodes || targetNaicsCodes.length === 0) {
      return NextResponse.json(
        { error: 'No NAICS codes available for sync' },
        { status: 400 }
      )
    }

    // Check rate limiting (basic implementation)
    if (!forceRefresh) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: recentSync } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('action', 'sync_opportunities')
        .gte('created_at', oneHourAgo)
        .limit(1)

      if (recentSync && recentSync.length > 0) {
        return NextResponse.json(
          { error: 'Sync already performed in the last hour' },
          { status: 429 }
        )
      }
    }

    // Fetch opportunities from SAM.gov
    const searchResults = await samApiClient.getOpportunitiesByNAICS(
      targetNaicsCodes,
      limit
    )

    if (searchResults.opportunities.length === 0) {
      // Log the sync attempt
      await supabase.rpc('log_audit', {
        p_action: 'sync_opportunities',
        p_entity_type: 'opportunities',
        p_changes: { naicsCodes: targetNaicsCodes, result: 'no_opportunities' }
      })

      return NextResponse.json({
        message: 'No opportunities found for specified NAICS codes',
        inserted: 0,
        updated: 0,
        total: 0
      })
    }

    // Sync to database
    const syncResult = await syncOpportunitiesToDatabase(searchResults.opportunities)

    // Log the sync
    await supabase.rpc('log_audit', {
      p_action: 'sync_opportunities',
      p_entity_type: 'opportunities',
      p_changes: {
        naicsCodes: targetNaicsCodes,
        ...syncResult,
        total: searchResults.opportunities.length
      }
    })

    return NextResponse.json({
      message: 'Sync completed successfully',
      ...syncResult,
      total: searchResults.opportunities.length
    })

  } catch (error) {
    console.error('Opportunity sync error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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

    // Get sync history for this user
    const { data: syncHistory } = await supabase
      .from('audit_logs')
      .select('created_at, changes')
      .eq('user_id', user.id)
      .eq('action', 'sync_opportunities')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      history: syncHistory || []
    })

  } catch (error) {
    console.error('Sync history error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}