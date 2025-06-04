/**
 * API Route: Sync opportunities from SAM.gov
 * POST /api/opportunities/sync
 * GET /api/opportunities/sync
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler'
import { samApiClient } from '@/lib/sam-gov'
import { syncOpportunitiesToDatabase } from '@/lib/sam-gov/utils'
import { 
  NotFoundError,
  ValidationError,
  RateLimitError,
  DatabaseError 
} from '@/lib/errors/types'

// Request body validation schema
const syncRequestSchema = z.object({
  naicsCodes: z.array(z.string()).optional(),
  limit: z.number().min(1).max(1000).optional().default(100),
  forceRefresh: z.boolean().optional().default(false)
})

export const POST = routeHandler.POST(
  async ({ user, supabase, sanitizedBody }) => {
    const { naicsCodes, limit, forceRefresh } = sanitizedBody

    // Check if user has admin role or if this is their first sync
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new NotFoundError('Profile')
    }

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
      throw new ValidationError('No NAICS codes available for sync')
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
        throw new RateLimitError('Sync already performed in the last hour', 3600)
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
  },
  {
    requireAuth: true,
    validateBody: syncRequestSchema,
    rateLimit: 'sync'
  }
)

export const GET = routeHandler.GET(
  async ({ user, supabase }) => {
    // Get sync history for this user
    const { data: syncHistory, error } = await supabase
      .from('audit_logs')
      .select('created_at, changes')
      .eq('user_id', user.id)
      .eq('action', 'sync_opportunities')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      throw new DatabaseError('Failed to fetch sync history', error)
    }

    return NextResponse.json({
      history: syncHistory || []
    })
  },
  {
    requireAuth: true,
    rateLimit: 'api'
  }
)