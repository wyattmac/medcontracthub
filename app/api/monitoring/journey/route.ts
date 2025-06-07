/**
 * User Journey Monitoring API
 * Endpoint for running user journey checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { createUserJourneyMonitor, CRITICAL_JOURNEYS } from '@/lib/monitoring/user-journey-monitor'
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'

export const GET = enhancedRouteHandler.GET(
  async ({ sanitizedQuery }) => {
    const monitor = createUserJourneyMonitor()
    
    const journeyName = sanitizedQuery?.journey
    const runAll = sanitizedQuery?.all === 'true'

    if (journeyName) {
      // Run specific journey
      const journey = CRITICAL_JOURNEYS.find(j => j.name === journeyName)
      if (!journey) {
        return NextResponse.json(
          { error: 'Journey not found', availableJourneys: CRITICAL_JOURNEYS.map(j => j.name) },
          { status: 404 }
        )
      }

      const result = await monitor.executeJourney(journey)
      return NextResponse.json({ result })
    }

    if (runAll) {
      // Run all journeys
      const results = await monitor.runAllJourneys()
      const summary = {
        totalJourneys: results.length,
        successfulJourneys: results.filter(r => r.success).length,
        failedJourneys: results.filter(r => !r.success).length,
        averageResponseTime: results.reduce((sum, r) => sum + r.totalTime, 0) / results.length,
        results
      }
      return NextResponse.json(summary)
    }

    // Return available journeys
    return NextResponse.json({
      message: 'User Journey Monitoring API',
      availableJourneys: CRITICAL_JOURNEYS.map(j => ({
        name: j.name,
        description: j.description,
        frequency: `${j.frequency} minutes`,
        steps: j.steps.length
      })),
      usage: {
        'Run specific journey': '/api/monitoring/journey?journey=landing-page-health',
        'Run all journeys': '/api/monitoring/journey?all=true'
      }
    })
  },
  {
    requireAuth: false, // Allow monitoring without auth
    rateLimit: 'monitoring'
  }
)

export const POST = enhancedRouteHandler.POST(
  async ({ sanitizedBody }) => {
    const monitor = createUserJourneyMonitor()
    const { journeyNames } = sanitizedBody

    if (!Array.isArray(journeyNames)) {
      return NextResponse.json(
        { error: 'journeyNames must be an array' },
        { status: 400 }
      )
    }

    const results = []
    for (const journeyName of journeyNames) {
      const journey = CRITICAL_JOURNEYS.find(j => j.name === journeyName)
      if (journey) {
        const result = await monitor.executeJourney(journey)
        results.push(result)
      } else {
        results.push({
          journeyName,
          success: false,
          error: 'Journey not found',
          timestamp: new Date()
        })
      }
    }

    return NextResponse.json({ results })
  },
  {
    requireAuth: false,
    rateLimit: 'monitoring'
  }
)