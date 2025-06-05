/**
 * Redis Client
 * Centralized Redis connection management
 */

import Redis from 'ioredis'
import { logger } from '@/infrastructure/monitoring/logger'

let redisClient: Redis | null = null

export async function createRedisClient(): Promise<Redis | null> {
  // Skip Redis in development unless explicitly configured
  if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
    return null
  }

  if (redisClient) {
    return redisClient
  }

  try {
    const redisUrl = process.env.REDIS_URL
    const redisPassword = process.env.REDIS_PASSWORD

    if (!redisUrl) {
      logger.warn('Redis URL not configured, using in-memory cache only')
      return null
    }

    redisClient = new Redis(redisUrl, {
      password: redisPassword,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries')
          return null
        }
        return Math.min(times * 200, 2000)
      },
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
        if (targetErrors.some(e => err.message.includes(e))) {
          return true
        }
        return false
      },
    })

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully')
    })

    redisClient.on('error', (error) => {
      logger.error('Redis error', error)
    })

    redisClient.on('close', () => {
      logger.warn('Redis connection closed')
    })

    // Test connection
    await redisClient.ping()

    return redisClient
  } catch (error) {
    logger.error('Failed to create Redis client', error)
    return null
  }
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}

export function getRedisClient(): Redis | null {
  return redisClient
}