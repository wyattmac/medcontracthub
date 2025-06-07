/**
 * Production-Ready Redis Rate Limiter
 * Implements sliding window rate limiting with Redis backing
 */

import { NextRequest } from 'next/server'
import { getRedisClient } from '@/lib/redis/client'
import { apiLogger } from '@/lib/errors/logger'
import { logRateLimitExceeded } from './security-monitor'

export interface RateLimitOptions {
  interval: number // Time window in milliseconds
  limit: number // Max requests per interval
  keyGenerator?: (request: NextRequest) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

// Default rate limit configurations
export const RATE_LIMITS = {
  // API endpoints
  api: { interval: 60 * 1000, limit: 60 }, // 60 req/min
  auth: { interval: 15 * 60 * 1000, limit: 5 }, // 5 req/15min for auth
  upload: { interval: 60 * 1000, limit: 10 }, // 10 req/min for uploads
  webhook: { interval: 60 * 1000, limit: 100 }, // 100 req/min for webhooks
  
  // User tiers
  starter: { interval: 60 * 1000, limit: 30 }, // 30 req/min
  professional: { interval: 60 * 1000, limit: 120 }, // 120 req/min
  enterprise: { interval: 60 * 1000, limit: 600 }, // 600 req/min
  
  // Specific endpoints
  ai: { interval: 60 * 60 * 1000, limit: 50 }, // 50 req/hour for AI
  export: { interval: 60 * 60 * 1000, limit: 20 }, // 20 req/hour for exports
  search: { interval: 60 * 1000, limit: 100 }, // 100 req/min for search
} as const

/**
 * Generate a unique identifier for rate limiting
 */
function getIdentifier(request: NextRequest): string {
  // Try to get user ID from headers (set by auth middleware)
  const userId = request.headers.get('x-user-id')
  if (userId) return `user:${userId}`
  
  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 
    request.headers.get('x-real-ip') || 
    'unknown'
  
  return `ip:${ip}`
}

/**
 * Redis-based sliding window rate limiter
 */
export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const identifier = options.keyGenerator ? 
    options.keyGenerator(request) : 
    getIdentifier(request)
  
  const key = `rate_limit:${identifier}`
  const now = Date.now()
  const windowStart = now - options.interval
  
  try {
    // Use Redis if available, otherwise fallback to in-memory
    const redisClient = getRedisClient()
    if (redisClient && redisClient.isReady) {
      return await redisRateLimit(key, now, windowStart, options, redisClient)
    } else {
      return await memoryRateLimit(key, now, windowStart, options)
    }
  } catch (error) {
    apiLogger.error('Rate limiting error', error)
    // On error, allow the request but log the issue
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      reset: now + options.interval
    }
  }
}

/**
 * Redis-based rate limiting implementation
 */
async function redisRateLimit(
  key: string,
  now: number,
  windowStart: number,
  options: RateLimitOptions,
  redisClient: any
): Promise<RateLimitResult> {
  const pipeline = redisClient.pipeline()
  
  // Remove expired entries
  pipeline.zremrangebyscore(key, 0, windowStart)
  
  // Count current requests in window
  pipeline.zcard(key)
  
  // Add current request
  pipeline.zadd(key, now, `${now}-${Math.random()}`)
  
  // Set expiration
  pipeline.expire(key, Math.ceil(options.interval / 1000))
  
  const results = await pipeline.exec()
  const count = results?.[1]?.[1] as number || 0
  
  const remaining = Math.max(0, options.limit - count - 1)
  const success = count < options.limit
  
  // If limit exceeded, remove the request we just added
  if (!success) {
    await redisClient.zremrangebyrank(key, -1, -1)
  }
  
  return {
    success,
    limit: options.limit,
    remaining,
    reset: now + options.interval,
    retryAfter: success ? undefined : Math.ceil(options.interval / 1000)
  }
}

/**
 * In-memory fallback rate limiting
 */
interface MemoryRateLimitData {
  requests: number[]
  lastCleanup: number
}

const memoryStore = new Map<string, MemoryRateLimitData>()

async function memoryRateLimit(
  key: string,
  now: number,
  windowStart: number,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  let data = memoryStore.get(key) || { requests: [], lastCleanup: now }
  
  // Clean up old requests
  data.requests = data.requests.filter(timestamp => timestamp > windowStart)
  
  const count = data.requests.length
  const remaining = Math.max(0, options.limit - count - 1)
  const success = count < options.limit
  
  if (success) {
    data.requests.push(now)
  }
  
  data.lastCleanup = now
  memoryStore.set(key, data)
  
  return {
    success,
    limit: options.limit,
    remaining,
    reset: now + options.interval,
    retryAfter: success ? undefined : Math.ceil(options.interval / 1000)
  }
}

/**
 * Cleanup old memory entries periodically
 */
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24 hours
  for (const [key, data] of memoryStore.entries()) {
    if (data.lastCleanup < cutoff) {
      memoryStore.delete(key)
    }
  }
}, 60 * 60 * 1000) // Run every hour

/**
 * Rate limiting middleware for API routes
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  return async (request: NextRequest) => {
    const result = await rateLimit(request, options)
    
    if (!result.success) {
      const identifier = getIdentifier(request)
      apiLogger.warn('Rate limit exceeded', {
        identifier,
        limit: result.limit,
        reset: new Date(result.reset)
      })
      
      // Log security event for monitoring
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                 request.headers.get('x-real-ip') || 
                 'unknown'
      
      logRateLimitExceeded(
        ip,
        request.url,
        request.headers.get('user-agent') || undefined
      )
    }
    
    return result
  }
}

/**
 * Apply rate limiting headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): void {
  response.headers.set('X-RateLimit-Limit', result.limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.reset.toString())
  
  if (result.retryAfter) {
    response.headers.set('Retry-After', result.retryAfter.toString())
  }
}