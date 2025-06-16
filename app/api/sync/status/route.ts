/**
 * API Route: Get sync status
 * GET /api/sync/status
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler-next15'
import { DatabaseError } from '@/lib/errors/types'

export const GET = routeHandler.GET(
  async ({ user, supabase }) => {
    // Get last sync activity from audit logs
    const { data: lastSyncLog, error: syncLogError } = await supabase
      .from('audit_logs')
      .select('*')
      .in('action', ['automated_sync', 'manual_sync'])
      .is('user_id', null) // System operations
      .order('created_at', { ascending: false })
      .limit(1)

    if (syncLogError) {
      throw new DatabaseError('Failed to fetch sync logs', syncLogError)
    }

    // Get last sync failure
    const { data: lastFailureLog } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'sync_failed')
      .is('user_id', null)
      .order('created_at', { ascending: false })
      .limit(1)

    // Get total opportunities count
    const { count: totalOpportunities } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })

    // Get recent opportunities count (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { count: recentOpportunities } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())

    // Determine current status
    let status = 'unknown'
    let lastSync = null
    let lastSyncStats = null
    let lastError = null

    if (lastSyncLog && lastSyncLog.length > 0) {
      const syncLog = lastSyncLog[0]
      lastSync = syncLog.created_at
      lastSyncStats = syncLog.changes as any

      // Check if there was a failure after the last success
      if (lastFailureLog && lastFailureLog.length > 0) {
        const failureTime = new Date(lastFailureLog[0].created_at).getTime()
        const syncTime = new Date(syncLog.created_at).getTime()
        
        if (failureTime > syncTime) {
          status = 'failed'
          lastError = (lastFailureLog[0].changes as any)?.error || 'Unknown error'
        } else {
          status = 'success'
        }
      } else {
        status = 'success'
      }
    } else if (lastFailureLog && lastFailureLog.length > 0) {
      status = 'failed'
      lastError = (lastFailureLog[0].changes as any)?.error || 'Unknown error'
    }

    // Calculate next sync time (every 6 hours)
    const nextSync = lastSync 
      ? new Date(new Date(lastSync).getTime() + 6 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now if no previous sync

    // Check if sync is currently running (simplified check)
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    
    const { data: runningSync } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'sync_started')
      .gte('created_at', fiveMinutesAgo.toISOString())
      .limit(1)

    if (runningSync && runningSync.length > 0) {
      status = 'running'
    }

    return NextResponse.json({
      status,
      lastSync,
      nextSync,
      lastSyncStats,
      lastError,
      totalOpportunities: totalOpportunities || 0,
      recentOpportunities: recentOpportunities || 0,
      syncInterval: '6 hours'
    })
  },
  {
    requireAuth: true,
    rateLimit: 'api'
  }
)