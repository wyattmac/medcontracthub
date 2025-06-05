/**
 * Cache Service
 * Unified caching layer with Redis and in-memory fallback
 */

import { Redis } from 'ioredis'
import { LRUCache } from 'lru-cache'
import { logger } from '@/infrastructure/monitoring/logger'

export interface ICacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[] // Cache tags for invalidation
}

export class CacheService {
  private redis: Redis | null
  private memoryCache: LRUCache<string, any>
  private keyPrefix: string

  constructor(
    redis: Redis | null,
    keyPrefix: string = 'mch:'
  ) {
    this.redis = redis
    this.keyPrefix = keyPrefix
    
    // In-memory cache fallback
    this.memoryCache = new LRUCache({
      max: 1000, // Maximum number of items
      ttl: 1000 * 60 * 5, // 5 minutes default TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    })
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.keyPrefix + key

    try {
      // Try Redis first
      if (this.redis) {
        const value = await this.redis.get(fullKey)
        if (value) {
          return JSON.parse(value)
        }
      }
    } catch (error) {
      logger.warn('Redis get error, falling back to memory', { error, key })
    }

    // Fallback to memory cache
    const memValue = this.memoryCache.get(fullKey)
    return memValue || null
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    tags?: string[]
  ): Promise<void> {
    const fullKey = this.keyPrefix + key
    const serialized = JSON.stringify(value)
    const ttl = ttlSeconds || 300 // 5 minutes default

    try {
      // Set in Redis
      if (this.redis) {
        const pipeline = this.redis.pipeline()
        
        if (ttlSeconds) {
          pipeline.setex(fullKey, ttl, serialized)
        } else {
          pipeline.set(fullKey, serialized)
        }

        // Add to tag sets for invalidation
        if (tags && tags.length > 0) {
          for (const tag of tags) {
            pipeline.sadd(`${this.keyPrefix}tag:${tag}`, fullKey)
            if (ttlSeconds) {
              pipeline.expire(`${this.keyPrefix}tag:${tag}`, ttl)
            }
          }
        }

        await pipeline.exec()
      }
    } catch (error) {
      logger.warn('Redis set error, using memory cache', { error, key })
    }

    // Always set in memory cache as backup
    this.memoryCache.set(fullKey, value, {
      ttl: ttl * 1000 // Convert to milliseconds
    })
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.keyPrefix + key

    try {
      if (this.redis) {
        await this.redis.del(fullKey)
      }
    } catch (error) {
      logger.warn('Redis delete error', { error, key })
    }

    this.memoryCache.delete(fullKey)
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    if (!this.redis || tags.length === 0) return

    try {
      const pipeline = this.redis.pipeline()
      
      for (const tag of tags) {
        const tagKey = `${this.keyPrefix}tag:${tag}`
        
        // Get all keys with this tag
        const keys = await this.redis.smembers(tagKey)
        
        if (keys.length > 0) {
          // Delete all keys
          pipeline.del(...keys)
          
          // Also remove from memory cache
          for (const key of keys) {
            this.memoryCache.delete(key)
          }
        }
        
        // Delete the tag set itself
        pipeline.del(tagKey)
      }

      await pipeline.exec()
    } catch (error) {
      logger.error('Failed to invalidate cache by tags', { error, tags })
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      if (this.redis) {
        // Get all keys with our prefix
        const keys = await this.redis.keys(`${this.keyPrefix}*`)
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      }
    } catch (error) {
      logger.error('Failed to clear Redis cache', { error })
    }

    this.memoryCache.clear()
  }

  /**
   * Create cache key from parts
   */
  createKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          acc[key] = params[key]
        }
        return acc
      }, {} as Record<string, any>)

    const paramString = Object.entries(sortedParams)
      .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
      .join(':')

    return `${prefix}:${paramString}`
  }

  /**
   * Invalidate specific cache key
   */
  async invalidate(key: string): Promise<void> {
    await this.delete(key)
  }

  /**
   * Memoize function result
   */
  async memoize<T>(
    key: string,
    fn: () => Promise<T>,
    options?: ICacheOptions
  ): Promise<T> {
    // Check cache first
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Execute function
    const result = await fn()

    // Cache result
    await this.set(key, result, options?.ttl, options?.tags)

    return result
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memory: {
        size: this.memoryCache.size,
        calculatedSize: this.memoryCache.calculatedSize,
      },
      redis: {
        connected: this.redis?.status === 'ready'
      }
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(warmUpFn: () => Promise<void>): Promise<void> {
    try {
      logger.info('Warming up cache...')
      await warmUpFn()
      logger.info('Cache warm-up completed')
    } catch (error) {
      logger.error('Cache warm-up failed', { error })
    }
  }
}