/**
 * SAM.gov API Caching Strategy
 * Minimize API calls through intelligent caching
 */

import { getRedisClient, isRedisAvailable } from '@/lib/redis/client'
import { MemoryCache, createCacheKey } from '@/lib/utils/cache'
import { apiLogger } from '@/lib/errors/logger'

// Cache configuration for different data types
export const CACHE_CONFIG = {
  // Opportunity search results - cache for 1 hour
  SEARCH_RESULTS: {
    ttl: 3600, // 1 hour
    prefix: 'sam:search:',
    maxSize: 1000
  },
  
  // Individual opportunity details - cache for 24 hours
  OPPORTUNITY_DETAIL: {
    ttl: 86400, // 24 hours
    prefix: 'sam:opp:',
    maxSize: 5000
  },
  
  // User-specific data (saved, analyzed) - cache for 5 minutes
  USER_DATA: {
    ttl: 300, // 5 minutes
    prefix: 'sam:user:',
    maxSize: 500
  },
  
  // NAICS and agency data - cache for 7 days
  REFERENCE_DATA: {
    ttl: 604800, // 7 days
    prefix: 'sam:ref:',
    maxSize: 200
  },
  
  // Quota status - cache for 1 minute
  QUOTA_STATUS: {
    ttl: 60, // 1 minute
    prefix: 'sam:quota:',
    maxSize: 10
  }
}

// Memory caches for different data types
const searchCache = new MemoryCache(CACHE_CONFIG.SEARCH_RESULTS.maxSize)
const detailCache = new MemoryCache(CACHE_CONFIG.OPPORTUNITY_DETAIL.maxSize)
const userCache = new MemoryCache(CACHE_CONFIG.USER_DATA.maxSize)
const referenceCache = new MemoryCache(CACHE_CONFIG.REFERENCE_DATA.maxSize)

export class SAMCacheStrategy {
  private redis = getRedisClient()

  /**
   * Get cached data with fallback to Redis and memory
   */
  async get<T>(
    key: string,
    cacheType: keyof typeof CACHE_CONFIG
  ): Promise<T | null> {
    const config = CACHE_CONFIG[cacheType]
    const fullKey = config.prefix + key
    
    // Check memory cache first
    const memoryCache = this.getMemoryCache(cacheType)
    const memoryResult = memoryCache.get<T>(fullKey)
    if (memoryResult !== null) {
      return memoryResult
    }
    
    // Check Redis if available
    if (await isRedisAvailable()) {
      try {
        const redisResult = await this.redis.get(fullKey)
        if (redisResult) {
          const data = JSON.parse(redisResult) as T
          // Populate memory cache
          memoryCache.set(fullKey, data, config.ttl)
          return data
        }
      } catch (error) {
        apiLogger.warn('Redis cache get failed', error as Error)
      }
    }
    
    return null
  }

  /**
   * Set cached data in both memory and Redis
   */
  async set<T>(
    key: string,
    data: T,
    cacheType: keyof typeof CACHE_CONFIG,
    customTtl?: number
  ): Promise<void> {
    const config = CACHE_CONFIG[cacheType]
    const fullKey = config.prefix + key
    const ttl = customTtl || config.ttl
    
    // Set in memory cache
    const memoryCache = this.getMemoryCache(cacheType)
    memoryCache.set(fullKey, data, ttl)
    
    // Set in Redis if available
    if (await isRedisAvailable()) {
      try {
        await this.redis.setex(fullKey, ttl, JSON.stringify(data))
      } catch (error) {
        apiLogger.warn('Redis cache set failed', error as Error)
      }
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(pattern: string, cacheType?: keyof typeof CACHE_CONFIG): Promise<void> {
    if (cacheType) {
      const config = CACHE_CONFIG[cacheType]
      const memoryCache = this.getMemoryCache(cacheType)
      memoryCache.clearPattern(config.prefix + pattern)
    } else {
      // Clear all caches
      searchCache.clear()
      detailCache.clear()
      userCache.clear()
      referenceCache.clear()
    }
    
    // Clear Redis if available
    if (await isRedisAvailable()) {
      try {
        const keys = await this.redis.keys(`sam:*${pattern}*`)
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      } catch (error) {
        apiLogger.warn('Redis cache invalidation failed', error as Error)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      search: searchCache.getStats(),
      detail: detailCache.getStats(),
      user: userCache.getStats(),
      reference: referenceCache.getStats()
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(data: {
    opportunities?: any[]
    naicsCodes?: string[]
    agencies?: string[]
  }): Promise<void> {
    if (data.opportunities) {
      // Cache individual opportunities
      for (const opp of data.opportunities) {
        await this.set(
          opp.noticeId || opp.id,
          opp,
          'OPPORTUNITY_DETAIL'
        )
      }
    }
    
    if (data.naicsCodes) {
      await this.set('naics-codes', data.naicsCodes, 'REFERENCE_DATA')
    }
    
    if (data.agencies) {
      await this.set('agencies', data.agencies, 'REFERENCE_DATA')
    }
  }

  private getMemoryCache(cacheType: keyof typeof CACHE_CONFIG): MemoryCache {
    switch (cacheType) {
      case 'SEARCH_RESULTS':
        return searchCache
      case 'OPPORTUNITY_DETAIL':
        return detailCache
      case 'USER_DATA':
        return userCache
      case 'REFERENCE_DATA':
        return referenceCache
      default:
        return searchCache
    }
  }
}

// Singleton instance
let _cacheStrategy: SAMCacheStrategy | null = null

export function getSAMCacheStrategy(): SAMCacheStrategy {
  if (!_cacheStrategy) {
    _cacheStrategy = new SAMCacheStrategy()
  }
  return _cacheStrategy
}

/**
 * Cache-first wrapper for API calls
 */
export async function withCache<T>(
  key: string,
  cacheType: keyof typeof CACHE_CONFIG,
  fn: () => Promise<T>,
  options?: {
    ttl?: number
    skipCache?: boolean
    forceRefresh?: boolean
  }
): Promise<T> {
  const cache = getSAMCacheStrategy()
  
  // Skip cache if requested
  if (options?.skipCache) {
    return fn()
  }
  
  // Check cache first unless force refresh
  if (!options?.forceRefresh) {
    const cached = await cache.get<T>(key, cacheType)
    if (cached !== null) {
      apiLogger.info('Cache hit', { key, cacheType })
      return cached
    }
  }
  
  // Execute function and cache result
  apiLogger.info('Cache miss, executing function', { key, cacheType })
  const result = await fn()
  
  // Cache the result
  await cache.set(key, result, cacheType, options?.ttl)
  
  return result
}

/**
 * Batch API calls to reduce quota usage
 */
export class BatchProcessor<T> {
  private queue: Array<{
    id: string
    resolve: (value: T) => void
    reject: (error: any) => void
  }> = []
  private timer: NodeJS.Timeout | null = null
  
  constructor(
    private batchFn: (ids: string[]) => Promise<Map<string, T>>,
    private maxBatchSize = 50,
    private maxWaitTime = 100 // ms
  ) {}
  
  async get(id: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id, resolve, reject })
      
      if (this.queue.length >= this.maxBatchSize) {
        this.flush()
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.maxWaitTime)
      }
    })
  }
  
  private async flush() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    
    if (this.queue.length === 0) return
    
    const batch = this.queue.splice(0, this.maxBatchSize)
    const ids = batch.map(item => item.id)
    
    try {
      const results = await this.batchFn(ids)
      
      batch.forEach(({ id, resolve, reject }) => {
        const result = results.get(id)
        if (result !== undefined) {
          resolve(result)
        } else {
          reject(new Error(`No result for ID: ${id}`))
        }
      })
    } catch (error) {
      batch.forEach(({ reject }) => reject(error))
    }
  }
}