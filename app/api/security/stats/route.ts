/**
 * Security Statistics API
 * Provides security monitoring data for administrators
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler-next15'
import { securityMonitor } from '@/lib/security/security-monitor'
import { z } from 'zod'

const statsSchema = z.object({
  hours: z.number().min(1).max(168).optional().default(24) // Max 1 week
})

export const GET = routeHandler.GET(
  async ({ user, supabase, searchParams }) => {
    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    const hours = parseInt(searchParams.get('hours') || '24', 10)
    const stats = await securityMonitor.getSecurityStats(hours)

    return NextResponse.json({
      success: true,
      data: stats
    })
  },
  { 
    requireAuth: true,
    rateLimit: 'api',
    requireCSRF: true
  }
)