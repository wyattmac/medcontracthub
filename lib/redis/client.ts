/**
 * Redis Client for Production Rate Limiting & Caching
 * Uses ioredis for robust Redis connections
 */

import Redis from 'ioredis'
import { apiLogger } from '@/lib/errors/logger'

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
}

// Create Redis client with connection URL support
let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL
    
    if (redisUrl) {
      // Use connection URL if provided (for production)
      redisClient = new Redis(redisUrl, {
        retryStrategy: redisConfig.retryStrategy,
        maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
        enableReadyCheck: redisConfig.enableReadyCheck,
      })
    } else {
      // Use individual config options (for development)
      redisClient = new Redis(redisConfig)
    }

    // Error handling
    redisClient.on('error', (error) => {
      apiLogger.error('Redis connection error', error)
    })

    redisClient.on('connect', () => {
      apiLogger.info('Redis connected successfully')
    })

    redisClient.on('ready', () => {
      apiLogger.info('Redis ready to accept commands')
    })

    redisClient.on('close', () => {
      apiLogger.warn('Redis connection closed')
    })

    redisClient.on('reconnecting', (delay: number) => {
      apiLogger.info(`Redis reconnecting in ${delay}ms`)
    })
  }

  return redisClient
}

// Graceful shutdown
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}

// Health check
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient()
    const result = await client.ping()
    return result === 'PONG'
  } catch (error) {
    apiLogger.error('Redis health check failed', error as Error)
    return false
  }
}

// Utility functions for common operations
export const redis = {
  // Get client
  client: () => getRedisClient(),

  // Key-value operations
  async get(key: string): Promise<string | null> {
    try {
      return await getRedisClient().get(key)
    } catch (error) {
      apiLogger.error('Redis get error', error as Error, { key })
      return null
    }
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      const client = getRedisClient()
      if (ttlSeconds) {
        await client.setex(key, ttlSeconds, value)
      } else {
        await client.set(key, value)
      }
      return true
    } catch (error) {
      apiLogger.error('Redis set error', error as Error, { key })
      return false
    }
  },

  async del(key: string): Promise<boolean> {
    try {
      await getRedisClient().del(key)
      return true
    } catch (error) {
      apiLogger.error('Redis del error', error as Error, { key })
      return false
    }
  },

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await getRedisClient().hget(key, field)
    } catch (error) {
      apiLogger.error('Redis hget error', error as Error, { key, field })
      return null
    }
  },

  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      await getRedisClient().hset(key, field, value)
      return true
    } catch (error) {
      apiLogger.error('Redis hset error', error as Error, { key, field })
      return false
    }
  },

  // List operations for queues
  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await getRedisClient().lpush(key, ...values)
    } catch (error) {
      apiLogger.error('Redis lpush error', error as Error, { key })
      return 0
    }
  },

  async rpop(key: string): Promise<string | null> {
    try {
      return await getRedisClient().rpop(key)
    } catch (error) {
      apiLogger.error('Redis rpop error', error as Error, { key })
      return null
    }
  },

  // Rate limiting helpers
  async incr(key: string): Promise<number> {
    try {
      return await getRedisClient().incr(key)
    } catch (error) {
      apiLogger.error('Redis incr error', error as Error, { key })
      return 0
    }
  },

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      await getRedisClient().expire(key, seconds)
      return true
    } catch (error) {
      apiLogger.error('Redis expire error', error as Error, { key })
      return false
    }
  },

  async ttl(key: string): Promise<number> {
    try {
      return await getRedisClient().ttl(key)
    } catch (error) {
      apiLogger.error('Redis ttl error', error as Error, { key })
      return -1
    }
  },

  // Atomic operations
  async setnx(key: string, value: string): Promise<boolean> {
    try {
      const result = await getRedisClient().setnx(key, value)
      return result === 1
    } catch (error) {
      apiLogger.error('Redis setnx error', error as Error, { key })
      return false
    }
  },

  // Pipeline for batch operations
  pipeline() {
    return getRedisClient().pipeline()
  },

  // Pub/Sub
  async publish(channel: string, message: string): Promise<number> {
    try {
      return await getRedisClient().publish(channel, message)
    } catch (error) {
      apiLogger.error('Redis publish error', error as Error, { channel })
      return 0
    }
  },

  // Caching helpers
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await getRedisClient().get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      apiLogger.error('Redis getJSON error', error as Error, { key })
      return null
    }
  },

  async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      const stringValue = JSON.stringify(value)
      return await redis.set(key, stringValue, ttlSeconds)
    } catch (error) {
      apiLogger.error('Redis setJSON error', error as Error, { key })
      return false
    }
  },
}

// Export types
export type { Redis }