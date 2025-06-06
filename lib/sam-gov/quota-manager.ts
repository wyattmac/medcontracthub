/**
 * SAM.gov API Quota Management
 * 1000 calls per day limit - intelligent usage optimization
 */

import { getRedisClient, isRedisAvailable } from '@/lib/redis/client'
import { createServiceClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/errors/logger'
import { RateLimitError } from '@/lib/errors/types'
import { MemoryCache, createCacheKey } from '@/lib/utils/cache'

interface QuotaUsage {
  daily: {
    used: number
    remaining: number
    resetsAt: Date
  }
  hourly: {
    used: number
    remaining: number
    resetsAt: Date
  }
}

interface QuotaConfig {
  dailyLimit: number
  hourlyLimit: number
  emergencyThreshold: number
  warningThreshold: number
}

const DEFAULT_CONFIG: QuotaConfig = {
  dailyLimit: 1000,
  hourlyLimit: 50, // Conservative hourly limit
  emergencyThreshold: 50, // Save last 50 calls for critical operations
  warningThreshold: 200 // Start optimizing when 200 calls remain
}

// High-performance cache for quota checks
const quotaCache = new MemoryCache(100)

export class SAMQuotaManager {
  private config: QuotaConfig
  private redisAvailable: boolean

  constructor(config: Partial<QuotaConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.redisAvailable = isRedisAvailable()
    
    if (!this.redisAvailable) {
      apiLogger?.warn('SAM.gov quota manager operating without Redis - using in-memory fallback')
    }
  }

  private getRedis() {
    return this.redisAvailable ? getRedisClient() : null
  }

  /**
   * Check if API call is allowed
   */
  async checkQuota(
    operation: 'search' | 'detail' | 'health' | 'sync' = 'search',
    userId?: string
  ): Promise<QuotaUsage> {
    const now = new Date()
    const todayKey = this.getDayKey(now)
    const hourKey = this.getHourKey(now)

    // Get current usage
    const [dailyUsed, hourlyUsed] = await Promise.all([
      this.getUsage(todayKey, 'daily'),
      this.getUsage(hourKey, 'hourly')
    ])

    const quotaUsage: QuotaUsage = {
      daily: {
        used: dailyUsed,
        remaining: this.config.dailyLimit - dailyUsed,
        resetsAt: this.getEndOfDay(now)
      },
      hourly: {
        used: hourlyUsed,
        remaining: this.config.hourlyLimit - hourlyUsed,
        resetsAt: this.getEndOfHour(now)
      }
    }

    // Check limits
    if (dailyUsed >= this.config.dailyLimit) {
      throw new RateLimitError(
        'Daily SAM.gov API limit reached. Quota resets at midnight.',
        this.getSecondsUntilEndOfDay(now)
      )
    }

    if (hourlyUsed >= this.config.hourlyLimit) {
      throw new RateLimitError(
        'Hourly SAM.gov API limit reached. Please wait before trying again.',
        this.getSecondsUntilEndOfHour(now)
      )
    }

    // Emergency preservation check
    if (operation !== 'health' && quotaUsage.daily.remaining <= this.config.emergencyThreshold) {
      throw new RateLimitError(
        'API quota preserved for critical operations. Please try again tomorrow.',
        this.getSecondsUntilEndOfDay(now)
      )
    }

    // Log warning threshold
    if (quotaUsage.daily.remaining <= this.config.warningThreshold) {
      apiLogger.warn('SAM.gov API quota warning', {
        remaining: quotaUsage.daily.remaining,
        operation,
        userId
      })
    }

    return quotaUsage
  }

  /**
   * Record API call usage
   */
  async recordUsage(
    operation: 'search' | 'detail' | 'health' | 'sync' = 'search',
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const now = new Date()
    const todayKey = this.getDayKey(now)
    const hourKey = this.getHourKey(now)

    try {
      if (await isRedisAvailable()) {
        // Increment counters atomically
        await Promise.all([
          this.incrementUsage(todayKey, 'daily'),
          this.incrementUsage(hourKey, 'hourly')
        ])
      }

      // Record in database for analytics
      const supabase = createServiceClient()
      await supabase.from('sam_api_usage').insert({
        operation,
        user_id: userId,
        metadata: metadata || {},
        created_at: now.toISOString()
      })

      // Clear quota cache to force refresh
      quotaCache.clearPattern('quota:*')
      
    } catch (error) {
      apiLogger.error('Failed to record SAM API usage', error as Error, {
        operation,
        userId
      })
    }
  }

  /**
   * Get current quota status
   */
  async getQuotaStatus(): Promise<QuotaUsage & { 
    config: QuotaConfig
    analytics: {
      topOperations: Array<{ operation: string; count: number }>
      topUsers: Array<{ user_id: string; count: number }>
      hourlyPattern: Array<{ hour: number; count: number }>
    }
  }> {
    const quotaUsage = await this.checkQuota('health')
    
    // Get analytics from database
    const supabase = createServiceClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [operationStats, userStats, hourlyStats] = await Promise.all([
      supabase
        .from('sam_api_usage')
        .select('operation')
        .gte('created_at', today.toISOString())
        .then(({ data }) => {
          const counts: Record<string, number> = {}
          data?.forEach(row => {
            counts[row.operation] = (counts[row.operation] || 0) + 1
          })
          return Object.entries(counts)
            .map(([operation, count]) => ({ operation, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }),

      supabase
        .from('sam_api_usage')
        .select('user_id')
        .gte('created_at', today.toISOString())
        .not('user_id', 'is', null)
        .then(({ data }) => {
          const counts: Record<string, number> = {}
          data?.forEach(row => {
            if (row.user_id) {
              counts[row.user_id] = (counts[row.user_id] || 0) + 1
            }
          })
          return Object.entries(counts)
            .map(([user_id, count]) => ({ user_id, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }),

      supabase
        .from('sam_api_usage')
        .select('created_at')
        .gte('created_at', today.toISOString())
        .then(({ data }) => {
          const counts: Record<number, number> = {}
          data?.forEach(row => {
            const hour = new Date(row.created_at).getHours()
            counts[hour] = (counts[hour] || 0) + 1
          })
          return Array.from({ length: 24 }, (_, hour) => ({
            hour,
            count: counts[hour] || 0
          }))
        })
    ])

    return {
      ...quotaUsage,
      config: this.config,
      analytics: {
        topOperations: operationStats || [],
        topUsers: userStats || [],
        hourlyPattern: hourlyStats || []
      }
    }
  }

  /**
   * Optimize API usage by suggesting alternatives
   */
  async getOptimizationSuggestions(): Promise<Array<{
    type: 'cache' | 'batch' | 'schedule' | 'filter'
    title: string
    description: string
    savings: number
  }>> {
    const status = await this.getQuotaStatus()
    const suggestions = []

    // High usage warning
    if (status.daily.remaining < this.config.warningThreshold) {
      suggestions.push({
        type: 'cache' as const,
        title: 'Enable Aggressive Caching',
        description: 'Increase cache TTL to 1 hour for search results',
        savings: 200
      })

      suggestions.push({
        type: 'batch' as const,
        title: 'Batch User Requests',
        description: 'Combine multiple user searches into single API calls',
        savings: 150
      })
    }

    // Schedule non-urgent calls
    if (status.hourly.used > this.config.hourlyLimit * 0.8) {
      suggestions.push({
        type: 'schedule' as const,
        title: 'Schedule Background Syncs',
        description: 'Delay non-urgent syncs to low-usage hours (2-6 AM)',
        savings: 100
      })
    }

    // Filter optimization
    suggestions.push({
      type: 'filter' as const,
      title: 'Optimize Search Filters',
      description: 'Use more specific NAICS codes to reduce result sets',
      savings: 75
    })

    return suggestions
  }

  /**
   * Execute API call with quota management
   */
  async withQuotaCheck<T>(
    operation: 'search' | 'detail' | 'health' | 'sync',
    userId: string | undefined,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    // Check quota before execution
    await this.checkQuota(operation, userId)

    try {
      // Execute the API call
      const result = await fn()

      // Record successful usage
      await this.recordUsage(operation, userId, metadata)

      return result
    } catch (error) {
      // Record failed attempt (but don't count against quota)
      apiLogger.error('SAM API call failed', error as Error, {
        operation,
        userId,
        metadata
      })
      throw error
    }
  }

  // Private helper methods
  private async getUsage(key: string, type: 'daily' | 'hourly'): Promise<number> {
    const cacheKey = `quota:${key}`
    const cached = quotaCache.get<number>(cacheKey)
    if (cached !== null) return cached

    try {
      const redis = this.getRedis()
      if (redis) {
        const usage = await redis.get(key)
        const count = usage ? parseInt(usage, 10) : 0
        quotaCache.set(cacheKey, count, 60) // Cache for 1 minute
        return count
      }
    } catch (error) {
      apiLogger?.error('Failed to get quota usage from Redis', error as Error)
    }

    return 0
  }

  private async incrementUsage(key: string, type: 'daily' | 'hourly'): Promise<void> {
    try {
      const redis = this.getRedis()
      if (redis) {
        await redis.incr(key)
        const expiry = type === 'daily' ? 86400 : 3600 // 24h or 1h
        await redis.expire(key, expiry)
      }
    } catch (error) {
      apiLogger?.error('Failed to increment quota usage in Redis', error as Error)
    }
  }

  private getDayKey(date: Date): string {
    return `sam_quota:daily:${date.toISOString().split('T')[0]}`
  }

  private getHourKey(date: Date): string {
    const hour = date.toISOString().substring(0, 13) // YYYY-MM-DDTHH
    return `sam_quota:hourly:${hour}`
  }

  private getEndOfDay(date: Date): Date {
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    return end
  }

  private getEndOfHour(date: Date): Date {
    const end = new Date(date)
    end.setMinutes(59, 59, 999)
    return end
  }

  private getSecondsUntilEndOfDay(date: Date): number {
    const end = this.getEndOfDay(date)
    return Math.floor((end.getTime() - date.getTime()) / 1000)
  }

  private getSecondsUntilEndOfHour(date: Date): number {
    const end = this.getEndOfHour(date)
    return Math.floor((end.getTime() - date.getTime()) / 1000)
  }
}

// Singleton instance
let _quotaManager: SAMQuotaManager | null = null

export function getSAMQuotaManager(): SAMQuotaManager {
  if (!_quotaManager) {
    _quotaManager = new SAMQuotaManager()
  }
  return _quotaManager
}

// Priority-based API call management
export enum CallPriority {
  CRITICAL = 1,    // Health checks, user-initiated searches
  HIGH = 2,        // Real-time requests, saves
  MEDIUM = 3,      // Background syncs, analytics
  LOW = 4          // Prefetching, optimization
}

export async function executeWithPriority<T>(
  priority: CallPriority,
  operation: 'search' | 'detail' | 'health' | 'sync',
  userId: string | undefined,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const quotaManager = getSAMQuotaManager()
  const status = await quotaManager.getQuotaStatus()

  // Emergency throttling for low-priority calls
  if (priority > CallPriority.HIGH && status.daily.remaining < 100) {
    throw new RateLimitError(
      'API quota preserved for high-priority operations',
      status.daily.resetsAt.getTime() - Date.now()
    )
  }

  return quotaManager.withQuotaCheck(operation, userId, fn, {
    ...metadata,
    priority: priority.toString()
  })
}