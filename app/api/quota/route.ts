/**
 * API Route: SAM.gov Quota Monitoring
 * GET /api/quota
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler-next15'
import { getSAMQuotaManager } from '@/lib/sam-gov/quota-manager'
import { DatabaseError } from '@/lib/errors/types'

export const GET = routeHandler.GET(
  async ({ user }) => {
    try {
      const quotaManager = getSAMQuotaManager()
      const status = await quotaManager.getQuotaStatus()
      const suggestions = await quotaManager.getOptimizationSuggestions()

      // Calculate efficiency metrics
      const dailyEfficiency = status.daily.used > 0 
        ? (status.analytics.topOperations.reduce((sum, op) => sum + op.count, 0) / status.daily.used) * 100
        : 100

      const hourlyDistribution = status.analytics.hourlyPattern.map(h => h.count)
      const peakHours = hourlyDistribution
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)

      return NextResponse.json({
        quota: {
          daily: status.daily,
          hourly: status.hourly
        },
        config: status.config,
        analytics: {
          ...status.analytics,
          efficiency: Math.round(dailyEfficiency),
          peakHours: peakHours.map(p => ({
            hour: p.hour,
            label: `${p.hour}:00`,
            count: p.count
          }))
        },
        optimization: {
          suggestions,
          recommendedActions: getRecommendedActions(status),
          nextOptimalWindow: getNextOptimalWindow(status.analytics.hourlyPattern)
        }
      })
    } catch (error) {
      throw new DatabaseError('Failed to fetch quota status', undefined, error as Error)
    }
  },
  {
    requireAuth: true,
    rateLimit: 'api'
  }
)

function getRecommendedActions(status: any): Array<{
  priority: 'high' | 'medium' | 'low'
  action: string
  description: string
  impact: string
}> {
  const actions = []
  const remaining = status.daily.remaining
  const used = status.daily.used

  if (remaining < 50) {
    actions.push({
      priority: 'high' as const,
      action: 'Emergency Conservation',
      description: 'Disable non-essential background syncs and increase cache TTL to 2 hours',
      impact: 'Preserves remaining calls for critical user operations'
    })
  } else if (remaining < 200) {
    actions.push({
      priority: 'high' as const,
      action: 'Enable Quota Conservation',
      description: 'Increase cache duration and batch similar requests',
      impact: 'Reduces API usage by 40-60%'
    })
  }

  if (used > 300) {
    actions.push({
      priority: 'medium' as const,
      action: 'Implement Request Batching',
      description: 'Combine multiple user searches into fewer API calls',
      impact: 'Can reduce daily usage by 20-30%'
    })
  }

  if (status.analytics.topUsers.length > 10) {
    actions.push({
      priority: 'medium' as const,
      action: 'User-specific Caching',
      description: 'Implement longer cache TTL for frequent users',
      impact: 'Reduces redundant API calls by heavy users'
    })
  }

  actions.push({
    priority: 'low' as const,
    action: 'Schedule Background Tasks',
    description: 'Move syncs to low-usage hours (2-6 AM)',
    impact: 'Better distribution of API usage throughout the day'
  })

  return actions
}

function getNextOptimalWindow(hourlyPattern: Array<{ hour: number; count: number }>): {
  hour: number
  label: string
  usageLevel: 'low' | 'medium' | 'high'
} {
  const currentHour = new Date().getHours()
  
  // Find the next 4-hour window with lowest usage
  const windows = []
  for (let i = 0; i < 24; i++) {
    const windowStart = (currentHour + i) % 24
    const windowUsage = hourlyPattern
      .slice(windowStart, windowStart + 4)
      .reduce((sum, h) => sum + h.count, 0)
    
    windows.push({
      hour: windowStart,
      usage: windowUsage,
      label: `${windowStart.toString().padStart(2, '0')}:00-${((windowStart + 4) % 24).toString().padStart(2, '0')}:00`
    })
  }

  const optimal = windows.sort((a, b) => a.usage - b.usage)[0]
  const maxUsage = Math.max(...windows.map(w => w.usage))
  
  let usageLevel: 'low' | 'medium' | 'high' = 'low'
  if (optimal.usage > maxUsage * 0.7) usageLevel = 'high'
  else if (optimal.usage > maxUsage * 0.4) usageLevel = 'medium'

  return {
    hour: optimal.hour,
    label: optimal.label,
    usageLevel
  }
}