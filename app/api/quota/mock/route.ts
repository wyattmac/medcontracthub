/**
 * Mock API Route: SAM.gov Quota Monitoring for Development
 * GET /api/quota/mock
 */

import { NextResponse } from 'next/server'

export async function GET() {
  // Return mock quota data for development
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
  
  // Mock usage - simulate some API usage
  const dailyUsed = Math.floor(Math.random() * 300) + 50 // Between 50-350 calls used
  const hourlyUsed = Math.floor(Math.random() * 15) + 2  // Between 2-17 calls this hour
  
  const dailyLimit = 1000
  const hourlyLimit = 50
  
  // Mock hourly pattern
  const hourlyPattern = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hour >= 6 && hour <= 22 
      ? Math.floor(Math.random() * 20) + 5  // Higher usage during business hours
      : Math.floor(Math.random() * 5)       // Lower usage at night
  }))
  
  // Mock top operations
  const topOperations = [
    { operation: 'search', count: Math.floor(dailyUsed * 0.6) },
    { operation: 'detail', count: Math.floor(dailyUsed * 0.25) },
    { operation: 'sync', count: Math.floor(dailyUsed * 0.1) },
    { operation: 'health', count: Math.floor(dailyUsed * 0.05) }
  ]
  
  // Mock top users (anonymized)
  const topUsers = [
    { user_id: 'user-1', count: Math.floor(dailyUsed * 0.3) },
    { user_id: 'user-2', count: Math.floor(dailyUsed * 0.2) },
    { user_id: 'user-3', count: Math.floor(dailyUsed * 0.15) }
  ]
  
  // Calculate efficiency
  const efficiency = Math.floor(85 + Math.random() * 10) // 85-95%
  
  // Peak hours (business hours with some variation)
  const peakHours = [
    { hour: 9, label: '09:00', count: hourlyPattern[9].count },
    { hour: 14, label: '14:00', count: hourlyPattern[14].count },
    { hour: 16, label: '16:00', count: hourlyPattern[16].count }
  ].sort((a, b) => b.count - a.count)
  
  // Generate optimization suggestions based on usage
  const suggestions = []
  const remaining = dailyLimit - dailyUsed
  
  if (remaining < 200) {
    suggestions.push({
      type: 'cache' as const,
      title: 'Enable Aggressive Caching',
      description: 'Increase cache TTL to 1 hour for search results',
      savings: 150
    })
    
    suggestions.push({
      type: 'batch' as const,
      title: 'Batch User Requests',
      description: 'Combine multiple user searches into single API calls',
      savings: 100
    })
  }
  
  if (hourlyUsed > hourlyLimit * 0.8) {
    suggestions.push({
      type: 'schedule' as const,
      title: 'Schedule Background Tasks',
      description: 'Move non-urgent operations to low-usage hours',
      savings: 75
    })
  }
  
  suggestions.push({
    type: 'filter' as const,
    title: 'Optimize Search Filters',
    description: 'Use more specific NAICS codes to reduce result sets',
    savings: 50
  })
  
  // Generate recommended actions
  const recommendedActions = []
  
  if (remaining < 50) {
    recommendedActions.push({
      priority: 'high' as const,
      action: 'Emergency Conservation',
      description: 'Disable non-essential background syncs and increase cache TTL to 2 hours',
      impact: 'Preserves remaining calls for critical user operations'
    })
  } else if (remaining < 200) {
    recommendedActions.push({
      priority: 'high' as const,
      action: 'Enable Quota Conservation',
      description: 'Increase cache duration and batch similar requests',
      impact: 'Reduces API usage by 40-60%'
    })
  }
  
  if (dailyUsed > 300) {
    recommendedActions.push({
      priority: 'medium' as const,
      action: 'Implement Request Batching',
      description: 'Combine multiple user searches into fewer API calls',
      impact: 'Can reduce daily usage by 20-30%'
    })
  }
  
  recommendedActions.push({
    priority: 'low' as const,
    action: 'Schedule Background Tasks',
    description: 'Move syncs to low-usage hours (2-6 AM)',
    impact: 'Better distribution of API usage throughout the day'
  })
  
  // Find next optimal window
  const lowUsageHours = hourlyPattern
    .map((h, index) => ({ ...h, hour: index }))
    .sort((a, b) => a.count - b.count)
    .slice(0, 4)
  
  const nextOptimalHour = lowUsageHours[0]
  const nextOptimalWindow = {
    hour: nextOptimalHour.hour,
    label: `${nextOptimalHour.hour.toString().padStart(2, '0')}:00-${((nextOptimalHour.hour + 4) % 24).toString().padStart(2, '0')}:00`,
    usageLevel: nextOptimalHour.count < 5 ? 'low' as const : 
                nextOptimalHour.count < 15 ? 'medium' as const : 'high' as const
  }
  
  const response = {
    quota: {
      daily: {
        used: dailyUsed,
        remaining: remaining,
        resetsAt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString()
      },
      hourly: {
        used: hourlyUsed,
        remaining: hourlyLimit - hourlyUsed,
        resetsAt: new Date(currentHour.getTime() + 60 * 60 * 1000).toISOString()
      }
    },
    config: {
      dailyLimit,
      hourlyLimit,
      emergencyThreshold: 50,
      warningThreshold: 200
    },
    analytics: {
      topOperations,
      topUsers,
      hourlyPattern,
      efficiency,
      peakHours
    },
    optimization: {
      suggestions,
      recommendedActions,
      nextOptimalWindow
    }
  }
  
  return NextResponse.json(response)
}