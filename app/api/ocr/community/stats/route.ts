/**
 * Community OCR Statistics API
 * GET /api/ocr/community/stats
 * 
 * Get statistics about community OCR sharing
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler-next15'
import { apiLogger } from '@/lib/errors/logger'
import { getRedisClient, isRedisAvailable } from '@/lib/redis/client'

interface CommunityStats {
  totalExtractions: number
  uniqueDocuments: number
  totalUsers: number
  totalSaves: {
    timeSavedHours: number
    costSaved: number
    apiCallsSaved: number
  }
  topContributors: Array<{
    userId: string
    username: string
    contributionScore: number
    extractionsShared: number
  }>
  recentActivity: Array<{
    type: 'shared' | 'used'
    timestamp: string
    documentType: string
  }>
  userStats?: {
    contributionScore: number
    extractionsShared: number
    extractionsUsed: number
    rankPercentile: number
  }
}

export const GET = routeHandler.GET(
  async ({ user, supabase }) => {
    try {
      // Try to get from cache first
      if (await isRedisAvailable()) {
        const redis = getRedisClient()
        const cached = await redis.get('community:stats:global')
        if (cached) {
          const stats = JSON.parse(cached)
          
          // Add user-specific stats if authenticated
          if (user) {
            stats.userStats = await getUserStats(supabase, user.id)
          }
          
          return NextResponse.json(stats)
        }
      }

      // Get global statistics
      const [
        extractionStats,
        userContribStats,
        savingsStats,
        recentActivity
      ] = await Promise.all([
        // Total extractions and unique documents
        supabase
          .from('community_extractions')
          .select('id, document_fingerprint', { count: 'exact' })
          .eq('status', 'active'),
        
        // User contribution statistics
        supabase
          .from('profiles')
          .select('id, full_name, community_contribution_score, total_extractions_shared')
          .gt('community_contribution_score', 0)
          .order('community_contribution_score', { ascending: false })
          .limit(10),
        
        // Calculate total savings
        supabase
          .from('community_extraction_usage')
          .select('saved_processing_time_ms, saved_api_cost'),
        
        // Recent activity
        supabase
          .from('community_extractions')
          .select('created_at, document_type')
          .order('created_at', { ascending: false })
          .limit(20)
      ])

      // Calculate aggregated stats
      const totalTimeSaved = savingsStats.data?.reduce(
        (sum, usage) => sum + (usage.saved_processing_time_ms || 0), 
        0
      ) || 0
      
      const totalCostSaved = savingsStats.data?.reduce(
        (sum, usage) => sum + (usage.saved_api_cost || 0), 
        0
      ) || 0

      const stats: CommunityStats = {
        totalExtractions: extractionStats.count || 0,
        uniqueDocuments: new Set(extractionStats.data?.map(e => e.document_fingerprint)).size,
        totalUsers: userContribStats.data?.length || 0,
        totalSaves: {
          timeSavedHours: Math.round(totalTimeSaved / 3600000 * 10) / 10,
          costSaved: Math.round(totalCostSaved * 100) / 100,
          apiCallsSaved: savingsStats.data?.length || 0
        },
        topContributors: userContribStats.data?.map(user => ({
          userId: user.id,
          username: user.full_name || 'Anonymous',
          contributionScore: user.community_contribution_score || 0,
          extractionsShared: user.total_extractions_shared || 0
        })) || [],
        recentActivity: recentActivity.data?.map(activity => ({
          type: 'shared' as const,
          timestamp: activity.created_at,
          documentType: activity.document_type
        })) || []
      }

      // Add user-specific stats if authenticated
      if (user) {
        stats.userStats = await getUserStats(supabase, user.id)
      }

      // Cache for 5 minutes
      if (await isRedisAvailable()) {
        const redis = getRedisClient()
        await redis.set(
          'community:stats:global',
          JSON.stringify(stats),
          'EX',
          300
        )
      }

      return NextResponse.json(stats)

    } catch (error) {
      apiLogger.error('Failed to get community stats', error as Error)
      return NextResponse.json(
        { error: 'Failed to retrieve community statistics' },
        { status: 500 }
      )
    }
  },
  { 
    requireAuth: false // Public stats, but enhanced for authenticated users
  }
)

/**
 * Get user-specific community statistics
 */
async function getUserStats(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      community_contribution_score,
      total_extractions_shared,
      total_extraction_uses
    `)
    .eq('id', userId)
    .single()

  if (!profile) {
    return null
  }

  // Calculate rank percentile
  const { count: usersWithLowerScore } = await supabase
    .from('profiles')
    .select('id', { count: 'exact' })
    .lt('community_contribution_score', profile.community_contribution_score)

  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact' })
    .gt('community_contribution_score', 0)

  const rankPercentile = totalUsers > 0 
    ? Math.round((usersWithLowerScore / totalUsers) * 100)
    : 0

  return {
    contributionScore: profile.community_contribution_score || 0,
    extractionsShared: profile.total_extractions_shared || 0,
    extractionsUsed: profile.total_extraction_uses || 0,
    rankPercentile
  }
}