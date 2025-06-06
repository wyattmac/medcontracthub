/**
 * API Route: Analytics data for dashboard
 * GET /api/analytics
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler, IRouteContext } from '@/lib/api/route-handler'
import { DatabaseError } from '@/lib/errors/types'
import { apiLogger } from '@/lib/errors/logger'
import { subDays, format, startOfDay, endOfDay } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Query parameters validation
const analyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  type: z.enum(['overview', 'opportunities', 'performance']).default('overview')
})

export const GET = routeHandler.GET(
  async ({ request, user, supabase }: IRouteContext) => {
    const { searchParams } = new URL(request.url)
    const { period, type } = analyticsQuerySchema.parse({
      period: searchParams.get('period') || '30d',
      type: searchParams.get('type') || 'overview'
    })

    // Calculate date range
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
    const startDate = startOfDay(subDays(new Date(), days))
    const endDate = endOfDay(new Date())

    try {
      const analyticsData: Record<string, any> = {}

      if (type === 'overview' || type === 'opportunities') {
        // Get opportunities analytics
        const opportunitiesData = await getOpportunitiesAnalytics(supabase, user.id, startDate, endDate, days)
        analyticsData.opportunities = opportunitiesData
      }

      if (type === 'overview' || type === 'performance') {
        // Get performance analytics
        const performanceData = await getPerformanceAnalytics(supabase, user.id, startDate, endDate)
        analyticsData.performance = performanceData
      }

      if (type === 'overview') {
        // Get summary stats
        const summaryData = await getSummaryStats(supabase, user.id)
        analyticsData.summary = summaryData
      }

      apiLogger.info('Analytics data fetched', {
        userId: user.id,
        period,
        type,
        dataPoints: analyticsData.opportunities?.timeline?.length || 0
      })

      return NextResponse.json({
        data: analyticsData,
        period,
        type,
        generatedAt: new Date().toISOString()
      })

    } catch (error) {
      apiLogger.error('Analytics generation failed', error, { 
        userId: user.id, 
        period, 
        type 
      })
      throw new DatabaseError('Failed to generate analytics data')
    }
  },
  {
    requireAuth: true,
    validateQuery: analyticsQuerySchema,
    rateLimit: 'api'
  }
)

/**
 * Get opportunities analytics data
 */
async function getOpportunitiesAnalytics(
  supabase: SupabaseClient<Database>, 
  userId: string, 
  startDate: Date, 
  endDate: Date,
  totalDays: number
) {
  // Get opportunities timeline data
  const { data: timelineData, error: timelineError } = await supabase
    .rpc('get_opportunities_timeline', {
      p_user_id: userId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_interval_days: Math.max(1, Math.floor(totalDays / 20)) // Max 20 data points
    })

  if (timelineError) {
    throw new DatabaseError('Failed to fetch opportunities timeline')
  }

  // Get opportunities by NAICS codes
  const { data: naicsData, error: naicsError } = await supabase
    .from('opportunities')
    .select('naics_codes')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (naicsError) {
    throw new DatabaseError('Failed to fetch NAICS data')
  }

  // Process NAICS distribution
  const naicsDistribution = processNaicsDistribution(naicsData)

  // Get opportunity status distribution
  const { data: statusData, error: statusError } = await supabase
    .from('opportunities')
    .select('status, id')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (statusError) {
    throw new DatabaseError('Failed to fetch status data')
  }

  const statusDistribution = statusData?.reduce((acc: Record<string, number>, item: { status: string; id: string }) => {
    const status = item.status || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {}) || {}

  return {
    timeline: timelineData || [],
    naicsDistribution,
    statusDistribution,
    totalOpportunities: statusData?.length || 0
  }
}

/**
 * Get performance analytics data  
 */
async function getPerformanceAnalytics(
  supabase: SupabaseClient<Database>,
  userId: string,
  startDate: Date,
  endDate: Date
) {
  // Get saved opportunities over time
  const { data: savedData, error: savedError } = await supabase
    .from('saved_opportunities')
    .select('created_at, opportunity_id')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true })

  if (savedError) {
    throw new DatabaseError('Failed to fetch saved opportunities data')
  }

  // Get AI analyses count - need to join with user's company
  const { data: userProfile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single()

  if (profileError || !userProfile?.company_id) {
    throw new DatabaseError('Failed to fetch user profile')
  }

  const { data: analysesData, error: analysesError } = await supabase
    .from('opportunity_analyses')
    .select('created_at, analysis_data')
    .eq('company_id', userProfile.company_id)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (analysesError) {
    throw new DatabaseError('Failed to fetch analyses data')
  }

  // Process performance metrics
  const dailyActivity = processDailyActivity(savedData, analysesData, startDate, endDate)
  
  // Calculate win probability distribution from analyses
  const winProbabilityData = analysesData?.map((analysis: { analysis_data: any; created_at: string }) => {
    try {
      const result = typeof analysis.analysis_data === 'string' 
        ? JSON.parse(analysis.analysis_data)
        : analysis.analysis_data
      return result.winProbability || 0
    } catch {
      return 0
    }
  }) || []

  const avgWinProbability = winProbabilityData.length > 0 
    ? winProbabilityData.reduce((a: number, b: number) => a + b, 0) / winProbabilityData.length
    : 0

  return {
    dailyActivity,
    totalSaved: savedData?.length || 0,
    totalAnalyses: analysesData?.length || 0,
    avgWinProbability: Math.round(avgWinProbability * 100) / 100,
    winProbabilityDistribution: processWinProbabilityDistribution(winProbabilityData)
  }
}

/**
 * Get summary statistics
 */
async function getSummaryStats(supabase: SupabaseClient<Database>, userId: string) {
  // Get total counts
  const [
    { count: totalOpportunities },
    { count: totalSaved },
    { count: totalAnalyses },
    { count: totalProposals }
  ] = await Promise.all([
    supabase.from('opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('saved_opportunities').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('opportunity_analyses').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('user_id', userId)
  ])

  // Get recent activity count (last 7 days)
  const sevenDaysAgo = subDays(new Date(), 7).toISOString()
  const { count: recentActivity } = await supabase
    .from('saved_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo)

  return {
    totalOpportunities: totalOpportunities || 0,
    totalSaved: totalSaved || 0,
    totalAnalyses: totalAnalyses || 0,
    totalProposals: totalProposals || 0,
    recentActivity: recentActivity || 0
  }
}

/**
 * Process NAICS codes distribution
 */
function processNaicsDistribution(naicsData: any[]) {
  const naicsCount: Record<string, number> = {}
  
  naicsData?.forEach((item) => {
    const codes = Array.isArray(item.naics_codes) ? item.naics_codes : []
    codes.forEach((code: string) => {
      naicsCount[code] = (naicsCount[code] || 0) + 1
    })
  })

  // Convert to array and sort by count
  return Object.entries(naicsCount)
    .map(([code, count]) => ({ code, count, name: getNaicsName(code) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // Top 10
}

/**
 * Process daily activity timeline
 */
function processDailyActivity(
  savedData: Array<{ created_at: string }>, 
  analysesData: Array<{ created_at: string }>, 
  startDate: Date, 
  endDate: Date
) {
  const dailyStats: Record<string, { saved: number; analyses: number; date: string }> = {}
  
  // Initialize all days with zero values
  let currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dateKey = format(currentDate, 'yyyy-MM-dd')
    dailyStats[dateKey] = { saved: 0, analyses: 0, date: dateKey }
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
  }

  // Count saved opportunities
  savedData?.forEach((item) => {
    const dateKey = format(new Date(item.created_at), 'yyyy-MM-dd')
    if (dailyStats[dateKey]) {
      dailyStats[dateKey].saved++
    }
  })

  // Count analyses
  analysesData?.forEach((item) => {
    const dateKey = format(new Date(item.created_at), 'yyyy-MM-dd')
    if (dailyStats[dateKey]) {
      dailyStats[dateKey].analyses++
    }
  })

  return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Process win probability distribution
 */
function processWinProbabilityDistribution(winProbabilities: number[]) {
  const ranges = [
    { min: 0, max: 20, label: '0-20%' },
    { min: 21, max: 40, label: '21-40%' },
    { min: 41, max: 60, label: '41-60%' },
    { min: 61, max: 80, label: '61-80%' },
    { min: 81, max: 100, label: '81-100%' }
  ]

  return ranges.map(range => ({
    ...range,
    count: winProbabilities.filter(prob => {
      const percentage = prob * 100
      return percentage >= range.min && percentage <= range.max
    }).length
  }))
}

/**
 * Get NAICS code name (simplified mapping)
 */
function getNaicsName(code: string): string {
  const naicsMap: Record<string, string> = {
    '621': 'Healthcare Services',
    '622': 'Hospitals',
    '623': 'Nursing & Residential Care',
    '325': 'Chemical Manufacturing',
    '334': 'Computer & Electronic Products',
    '336': 'Transportation Equipment',
    '541': 'Professional Services',
    '562': 'Waste Management',
    '811': 'Repair & Maintenance',
    '928': 'National Security'
  }
  
  // Try to find exact match or partial match
  const exactMatch = naicsMap[code]
  if (exactMatch) return exactMatch
  
  // Try partial match (first 3 digits)
  const partialMatch = naicsMap[code.substring(0, 3)]
  if (partialMatch) return partialMatch
  
  return `NAICS ${code}`
}