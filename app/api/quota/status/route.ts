import { NextResponse } from 'next/server'
import { getSAMQuotaManager } from '@/lib/sam-gov/quota-manager'
import { getSAMCacheStrategy } from '@/lib/sam-gov/cache-strategy'

export async function GET() {
  try {
    const quotaManager = getSAMQuotaManager()
    const cacheStrategy = getSAMCacheStrategy()
    
    // Get quota status
    const quotaStatus = await quotaManager.getQuotaStatus()
    
    // Get optimization suggestions
    const suggestions = await quotaManager.getOptimizationSuggestions()
    
    // Get cache statistics
    const cacheStats = cacheStrategy.getCacheStats()
    
    // Calculate savings from caching
    const totalCacheHits = Object.values(cacheStats).reduce(
      (sum, stat) => sum + stat.hits,
      0
    )
    
    return NextResponse.json({
      quota: {
        daily: quotaStatus.daily,
        hourly: quotaStatus.hourly,
        config: quotaStatus.config
      },
      analytics: quotaStatus.analytics,
      optimization: {
        suggestions,
        potentialSavings: suggestions.reduce((sum, s) => sum + s.savings, 0)
      },
      cache: {
        stats: cacheStats,
        totalHits: totalCacheHits,
        apiCallsSaved: totalCacheHits,
        estimatedCostSaved: `$${(totalCacheHits * 0.001).toFixed(2)}` // Assuming $0.001 per API call
      },
      recommendations: [
        {
          priority: 'high',
          action: 'Enable caching for all searches',
          impact: 'Save 200-500 API calls per day'
        },
        {
          priority: 'medium',
          action: 'Schedule syncs during off-peak hours (2-6 AM)',
          impact: 'Better quota distribution'
        },
        {
          priority: 'low',
          action: 'Use database-first approach for recent data',
          impact: 'Reduce real-time API calls'
        }
      ]
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get quota status' },
      { status: 500 }
    )
  }
}