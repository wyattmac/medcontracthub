/**
 * Redis-based Rate Limiting
 * Production-grade rate limiting with Redis backend
 */

import { NextRequest } from 'next/server'
import { redis } from './client'
import { apiLogger } from '@/lib/errors/logger'

interface IRateLimitOptions {
  interval: number // Time window in milliseconds
  uniqueTokenPerInterval: number // Max requests per interval
}

interface IRateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

/**
 * Check if Redis is available
 */
async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = redis.client()
    await client.ping()
    return true
  } catch {
    return false
  }
}

/**
 * Fallback in-memory rate limiter
 */
const inMemoryStore = new Map<string, { count: number; resetTime: number }>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  inMemoryStore.forEach((data, key) => {
    if (now > data.resetTime) {
      inMemoryStore.delete(key)
    }
  })
}, 5 * 60 * 1000)

/**
 * Rate limit with Redis (with in-memory fallback)
 */
export async function rateLimitRedis(
  request: NextRequest,
  options: IRateLimitOptions = {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 60 // 60 requests per minute
  }
): Promise<IRateLimitResult> {
  const identifier = getIdentifier(request)
  const key = `rate_limit:${identifier}`
  const now = Date.now()
  const window = Math.floor(now / options.interval)
  const resetTime = (window + 1) * options.interval
  const ttl = Math.ceil((resetTime - now) / 1000)

  // Check if Redis is available
  const useRedis = await isRedisAvailable()

  if (useRedis) {
    try {
      // Use Redis for rate limiting
      const redisKey = `${key}:${window}`
      
      // Use pipeline for atomic operations
      const pipeline = redis.pipeline()
      pipeline.incr(redisKey)
      pipeline.expire(redisKey, ttl)
      
      const results = await pipeline.exec()
      
      if (!results || results.length < 2) {
        throw new Error('Redis pipeline failed')
      }

      const [[incrErr, count]] = results
      
      if (incrErr) {
        throw incrErr
      }

      const currentCount = count as number
      const remaining = Math.max(0, options.uniqueTokenPerInterval - currentCount)

      if (currentCount > options.uniqueTokenPerInterval) {
        return {
          success: false,
          limit: options.uniqueTokenPerInterval,
          remaining: 0,
          reset: Math.floor(resetTime / 1000),
          retryAfter: ttl
        }
      }

      return {
        success: true,
        limit: options.uniqueTokenPerInterval,
        remaining,
        reset: Math.floor(resetTime / 1000)
      }
    } catch (error) {
      apiLogger.warn('Redis rate limit failed, falling back to in-memory', error as Error)
      // Fall through to in-memory implementation
    }
  }

  // In-memory fallback
  const memKey = `${key}:${window}`
  let data = inMemoryStore.get(memKey)

  if (!data) {
    data = { count: 0, resetTime }
    inMemoryStore.set(memKey, data)
  }

  data.count++

  if (data.count > options.uniqueTokenPerInterval) {
    return {
      success: false,
      limit: options.uniqueTokenPerInterval,
      remaining: 0,
      reset: Math.floor(resetTime / 1000),
      retryAfter: ttl
    }
  }

  return {
    success: true,
    limit: options.uniqueTokenPerInterval,
    remaining: options.uniqueTokenPerInterval - data.count,
    reset: Math.floor(resetTime / 1000)
  }
}

/**
 * Get unique identifier for rate limiting
 */
function getIdentifier(request: NextRequest): string {
  // Try to get real IP from headers (for production with proxies)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = request.ip || forwardedFor?.split(',')[0] || realIp || 'unknown'
  
  // Get authenticated user ID if available
  const userId = request.headers.get('x-user-id')
  
  // Use user ID if available, otherwise fall back to IP
  return userId || ip
}

/**
 * Advanced rate limiting with multiple strategies
 */
export async function advancedRateLimit(
  request: NextRequest,
  config: {
    global?: IRateLimitOptions // Global rate limit
    perUser?: IRateLimitOptions // Per-user rate limit
    perIp?: IRateLimitOptions // Per-IP rate limit
    burst?: number // Allow burst requests
  }
): Promise<IRateLimitResult> {
  const results: IRateLimitResult[] = []

  // Check global rate limit
  if (config.global) {
    const globalResult = await rateLimitRedis(
      request,
      config.global
    )
    results.push(globalResult)
  }

  // Check per-user rate limit
  const userId = request.headers.get('x-user-id')
  if (userId && config.perUser) {
    const userRequest = new NextRequest(request.url, {
      headers: new Headers(request.headers)
    })
    userRequest.headers.set('x-user-id', userId)
    
    const userResult = await rateLimitRedis(
      userRequest,
      config.perUser
    )
    results.push(userResult)
  }

  // Check per-IP rate limit
  if (config.perIp) {
    const ipResult = await rateLimitRedis(
      request,
      config.perIp
    )
    results.push(ipResult)
  }

  // Find the most restrictive result
  const mostRestrictive = results.reduce((prev, curr) => {
    if (!prev) return curr
    if (!curr.success) return curr
    if (curr.remaining < prev.remaining) return curr
    return prev
  })

  return mostRestrictive
}

/**
 * Rate limiting configurations for different endpoints
 */
export const redisRateLimitConfigs = {
  // Auth endpoints - stricter limits
  auth: {
    global: { interval: 60 * 1000, uniqueTokenPerInterval: 100 },
    perIp: { interval: 15 * 60 * 1000, uniqueTokenPerInterval: 5 }
  },
  
  // API endpoints - moderate limits
  api: {
    global: { interval: 60 * 1000, uniqueTokenPerInterval: 1000 },
    perUser: { interval: 60 * 1000, uniqueTokenPerInterval: 60 },
    perIp: { interval: 60 * 1000, uniqueTokenPerInterval: 100 }
  },
  
  // Search endpoints - more lenient
  search: {
    global: { interval: 60 * 1000, uniqueTokenPerInterval: 2000 },
    perUser: { interval: 60 * 1000, uniqueTokenPerInterval: 120 },
    burst: 10
  },
  
  // Sync endpoints - restricted
  sync: {
    global: { interval: 60 * 1000, uniqueTokenPerInterval: 100 },
    perUser: { interval: 60 * 1000, uniqueTokenPerInterval: 10 }
  },
  
  // AI endpoints - limited due to cost
  ai: {
    global: { interval: 60 * 1000, uniqueTokenPerInterval: 500 },
    perUser: { interval: 60 * 1000, uniqueTokenPerInterval: 20 },
    perIp: { interval: 60 * 1000, uniqueTokenPerInterval: 30 }
  },

  // OCR endpoints - very limited due to cost
  ocr: {
    global: { interval: 60 * 1000, uniqueTokenPerInterval: 100 },
    perUser: { interval: 60 * 60 * 1000, uniqueTokenPerInterval: 50 }, // 50 per hour
    perIp: { interval: 24 * 60 * 60 * 1000, uniqueTokenPerInterval: 100 } // 100 per day
  }
} as const

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: IRateLimitResult): Headers {
  const headers = new Headers()
  
  headers.set('X-RateLimit-Limit', result.limit.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', result.reset.toString())
  
  if (result.retryAfter) {
    headers.set('Retry-After', result.retryAfter.toString())
  }
  
  return headers
}

/**
 * Rate limiting middleware for Next.js API routes
 */
export function withRedisRateLimit(
  configOrKey: keyof typeof redisRateLimitConfigs | typeof redisRateLimitConfigs[keyof typeof redisRateLimitConfigs]
) {
  const config = typeof configOrKey === 'string' 
    ? redisRateLimitConfigs[configOrKey]
    : configOrKey

  return async function rateLimitMiddleware(request: NextRequest) {
    const result = await advancedRateLimit(request, config)
    
    if (!result.success) {
      const headers = createRateLimitHeaders(result)
      
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(headers.entries())
          }
        }
      )
    }
    
    return { 
      success: true, 
      headers: createRateLimitHeaders(result),
      result 
    }
  }
}