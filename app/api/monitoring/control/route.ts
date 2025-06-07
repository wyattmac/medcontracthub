/**
 * Monitoring Control API
 * Endpoint for controlling the monitoring scheduler
 */

import { NextResponse } from 'next/server'
import { getGlobalScheduler } from '@/lib/monitoring/scheduler'
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'

export const GET = enhancedRouteHandler.GET(
  async () => {
    const scheduler = getGlobalScheduler()
    const status = scheduler.getStatus()
    
    return NextResponse.json({
      monitoring: status,
      environment: process.env.NODE_ENV,
      monitoringEnabled: process.env.ENABLE_USER_JOURNEY_MONITORING === 'true',
      actions: {
        'Start monitoring': 'POST /api/monitoring/control { "action": "start" }',
        'Stop monitoring': 'POST /api/monitoring/control { "action": "stop" }',
        'Health check': 'POST /api/monitoring/control { "action": "health-check" }'
      }
    })
  },
  {
    requireAuth: false,
    rateLimit: 'monitoring'
  }
)

export const POST = enhancedRouteHandler.POST(
  async ({ sanitizedBody }) => {
    const { action } = sanitizedBody
    const scheduler = getGlobalScheduler()

    switch (action) {
      case 'start':
        scheduler.start()
        return NextResponse.json({ 
          message: 'Monitoring started',
          status: scheduler.getStatus()
        })

      case 'stop':
        scheduler.stop()
        return NextResponse.json({ 
          message: 'Monitoring stopped',
          status: scheduler.getStatus()
        })

      case 'health-check':
        const healthCheck = await scheduler.runHealthCheck()
        return NextResponse.json({
          message: 'Health check completed',
          ...healthCheck
        })

      case 'status':
        return NextResponse.json({
          status: scheduler.getStatus()
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: start, stop, health-check, status' },
          { status: 400 }
        )
    }
  },
  {
    requireAuth: false,
    rateLimit: 'monitoring'
  }
)