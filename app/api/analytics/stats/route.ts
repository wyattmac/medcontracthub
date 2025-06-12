/**
 * Simplified Analytics Stats API
 * GET /api/analytics/stats
 * Returns opportunity statistics without complex database functions
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withCache } from '@/lib/sam-gov/cache-strategy'
import { createCacheKey } from '@/lib/utils/cache'

export async function GET(request: Request) {
  try {
    // In development, return mock data immediately for better performance
    if (process.env.NODE_ENV === 'development' && process.env.DEVELOPMENT_AUTH_BYPASS === 'true') {
      return NextResponse.json({
        totalActive: 24567,
        newThisWeek: 342,
        expiringThisWeek: 89,
        totalValue: 4500000000,
        averageValue: 1850000,
        highMatchCount: 256,
        mediumMatchCount: 489,
        lowMatchCount: 1023
      })
    }
    
    // Use service client for better performance (bypasses RLS)
    const supabase = createServiceClient()
    
    // Create cache key
    const cacheKey = createCacheKey('opportunity-stats', {
      type: 'overview'
    })
    
    // Cache stats for 10 minutes (increased for better performance)
    const stats = await withCache(
      cacheKey,
      'USER_DATA',
      async () => {
        // Get date ranges
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        
        // Parallel queries for better performance
        const [
          totalActiveResult,
          newThisWeekResult,
          expiringThisWeekResult,
          valueStatsResult,
          matchDistributionResult
        ] = await Promise.all([
          // Total active opportunities
          supabase
            .from('opportunities')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active'),
          
          // New opportunities this week
          supabase
            .from('opportunities')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active')
            .gte('posted_date', weekAgo.toISOString()),
          
          // Expiring this week
          supabase
            .from('opportunities')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active')
            .gte('response_deadline', now.toISOString())
            .lte('response_deadline', weekFromNow.toISOString()),
          
          // Value statistics (simplified - just get a sample)
          supabase
            .from('opportunities')
            .select('estimated_value_min, estimated_value_max')
            .eq('status', 'active')
            .not('estimated_value_max', 'is', null)
            .order('posted_date', { ascending: false })
            .limit(100),
          
          // Match distribution (simplified - based on NAICS codes)
          supabase
            .from('opportunities')
            .select('naics_code')
            .eq('status', 'active')
            .limit(1000)
        ])
        
        // Calculate value statistics
        let totalValue = 0
        let valueCount = 0
        
        if (valueStatsResult.data) {
          valueStatsResult.data.forEach(opp => {
            if (opp.estimated_value_max) {
              totalValue += opp.estimated_value_max
              valueCount++
            }
          })
        }
        
        const averageValue = valueCount > 0 ? Math.round(totalValue / valueCount) : 0
        
        // Calculate match distribution (simplified)
        // High match: Medical NAICS codes (339*, 423450, 621*, 622*)
        // Medium match: Related healthcare (623*, 325412)
        // Low match: Everything else
        let highMatchCount = 0
        let mediumMatchCount = 0
        let lowMatchCount = 0
        
        if (matchDistributionResult.data) {
          matchDistributionResult.data.forEach(opp => {
            const naics = opp.naics_code || ''
            if (naics.startsWith('339') || naics === '423450' || 
                naics.startsWith('621') || naics.startsWith('622')) {
              highMatchCount++
            } else if (naics.startsWith('623') || naics === '325412') {
              mediumMatchCount++
            } else {
              lowMatchCount++
            }
          })
        }
        
        return {
          totalActive: totalActiveResult.count || 0,
          newThisWeek: newThisWeekResult.count || 0,
          expiringThisWeek: expiringThisWeekResult.count || 0,
          totalValue: totalValue * 10, // Extrapolate from sample
          averageValue: averageValue,
          highMatchCount,
          mediumMatchCount,
          lowMatchCount
        }
      },
      { ttl: 600 } // Cache for 10 minutes
    )
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Analytics stats error:', error)
    
    // Return default stats on error
    return NextResponse.json({
      totalActive: 0,
      newThisWeek: 0,
      expiringThisWeek: 0,
      totalValue: 0,
      averageValue: 0,
      highMatchCount: 0,
      mediumMatchCount: 0,
      lowMatchCount: 0
    })
  }
}