/**
 * Redis Cache Implementation for Ultra-Fast Performance
 * Provides distributed caching with automatic fallback to in-memory cache
 */

import { Redis } from 'ioredis'
import { MemoryCache } from './utils/cache'

// Redis configuration
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: false,
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY'
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true
    }
    return false
  }
}

class RedisCache {
  private redis: Redis | null = null
  private fallbackCache: MemoryCache
  private isConnected: boolean = false
  private connectionPromise: Promise<void> | null = null

  constructor() {
    this.fallbackCache = new MemoryCache(1000)
    
    // Only initialize Redis in production or when explicitly enabled
    if (process.env.ENABLE_REDIS === 'true' || process.env.NODE_ENV === 'production') {
      this.initializeRedis()
    }
  }

  private async initializeRedis(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise
    }

    this.connectionPromise = new Promise(async (resolve) => {
      try {
        this.redis = new Redis(REDIS_CONFIG)
        
        this.redis.on('connect', () => {
          console.log('Redis connected successfully')
          this.isConnected = true
        })

        this.redis.on('error', (err) => {
          console.error('Redis error:', err)
          this.isConnected = false
        })

        this.redis.on('close', () => {
          console.log('Redis connection closed')
          this.isConnected = false
        })

        await this.redis.connect()
        resolve()
      } catch (error) {
        console.error('Failed to initialize Redis:', error)
        this.isConnected = false
        resolve() // Continue with fallback cache
      }
    })

    return this.connectionPromise
  }

  /**
   * Get value from cache with automatic fallback
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first if connected
    if (this.isConnected && this.redis) {
      try {
        const value = await this.redis.get(key)
        if (value) {
          return JSON.parse(value) as T
        }
      } catch (error) {
        console.error('Redis get error:', error)
      }
    }

    // Fallback to memory cache
    return this.fallbackCache.get<T>(key)
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    // Set in memory cache first (immediate availability)
    this.fallbackCache.set(key, value, ttlSeconds)

    // Then set in Redis if connected
    if (this.isConnected && this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value))
      } catch (error) {
        console.error('Redis set error:', error)
      }
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    let deleted = false

    // Delete from memory cache
    deleted = this.fallbackCache.delete(key)

    // Delete from Redis if connected
    if (this.isConnected && this.redis) {
      try {
        const result = await this.redis.del(key)
        deleted = deleted || result > 0
      } catch (error) {
        console.error('Redis delete error:', error)
      }
    }

    return deleted
  }

  /**
   * Clear all cache entries matching pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    let deletedCount = 0

    // Clear from memory cache
    deletedCount += this.fallbackCache.clearPattern(pattern)

    // Clear from Redis if connected
    if (this.isConnected && this.redis) {
      try {
        const keys = await this.redis.keys(pattern)
        if (keys.length > 0) {
          const result = await this.redis.del(...keys)
          deletedCount += result
        }
      } catch (error) {
        console.error('Redis clearPattern error:', error)
      }
    }

    return deletedCount
  }

  /**
   * Get or set value with cache-aside pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Generate value
    const value = await factory()

    // Cache it
    await this.set(key, value, ttlSeconds)

    return value
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = []

    if (this.isConnected && this.redis) {
      try {
        const values = await this.redis.mget(...keys)
        return values.map(v => v ? JSON.parse(v) as T : null)
      } catch (error) {
        console.error('Redis mget error:', error)
      }
    }

    // Fallback to individual gets from memory cache
    for (const key of keys) {
      results.push(this.fallbackCache.get<T>(key))
    }

    return results
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.isConnected
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
    }
    this.fallbackCache.destroy()
  }
}

// Export singleton instance
export const redisCache = new RedisCache()

// Export cache decorators
export function cacheable<T extends (...args: any[]) => Promise<any>>(
  options: {
    ttlSeconds?: number
    keyPrefix?: string
    keyGenerator?: (...args: Parameters<T>) => string
  } = {}
): MethodDecorator {
  const ttl = options.ttlSeconds || 300
  const prefix = options.keyPrefix || 'cache'
  const generateKey = options.keyGenerator || ((...args) => `${prefix}:${JSON.stringify(args)}`)

  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const key = generateKey(...args)
      
      // Try to get from cache
      const cached = await redisCache.get(key)
      if (cached !== null) {
        return cached
      }

      // Call original method
      const result = await originalMethod.apply(this, args)

      // Cache the result
      await redisCache.set(key, result, ttl)

      return result
    }

    return descriptor
  }
}

// Clean up on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    redisCache.close()
  })
}