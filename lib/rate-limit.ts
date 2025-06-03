/**
 * Rate Limiting Utilities
 * Implements in-memory rate limiting with Redis-like interface
 * Production ready with automatic cleanup and configurable limits
 */

import { NextRequest } from 'next/server'

interface IRateLimitOptions {
  interval: number // Time window in milliseconds
  uniqueTokenPerInterval: number // Max requests per interval
}

interface IRateLimitData {
  count: number
  resetTime: number
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, IRateLimitData>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  rateLimitStore.forEach((data, key) => {
    if (now > data.resetTime) {
      rateLimitStore.delete(key)
    }
  })
}, 5 * 60 * 1000)

/**
 * Rate limit middleware function
 */
export async function rateLimit(
  request: NextRequest,
  options: IRateLimitOptions = {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 60 // 60 requests per minute
  }
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}> {
  const identifier = getIdentifier(request)
  const key = `rate_limit:${identifier}`
  const now = Date.now()
  const resetTime = Math.floor(now / options.interval) * options.interval + options.interval

  let data = rateLimitStore.get(key)

  if (!data || now > data.resetTime) {
    // Reset or initialize
    data = {
      count: 1,
      resetTime
    }
    rateLimitStore.set(key, data)
    
    return {
      success: true,
      limit: options.uniqueTokenPerInterval,
      remaining: options.uniqueTokenPerInterval - 1,
      reset: Math.floor(resetTime / 1000)
    }
  }

  if (data.count >= options.uniqueTokenPerInterval) {
    // Rate limit exceeded
    return {
      success: false,
      limit: options.uniqueTokenPerInterval,
      remaining: 0,
      reset: Math.floor(data.resetTime / 1000),
      retryAfter: Math.ceil((data.resetTime - now) / 1000)
    }
  }

  // Increment counter
  data.count++
  rateLimitStore.set(key, data)

  return {
    success: true,
    limit: options.uniqueTokenPerInterval,
    remaining: options.uniqueTokenPerInterval - data.count,
    reset: Math.floor(data.resetTime / 1000)
  }
}

/**
 * Get unique identifier for rate limiting
 * Uses IP address with fallback to user agent
 */
function getIdentifier(request: NextRequest): string {
  // Try to get real IP from headers (for production with proxies)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = request.ip || forwardedFor?.split(',')[0] || realIp || 'unknown'
  
  // Include user agent for additional uniqueness
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  return `${ip}:${userAgent.slice(0, 50)}` // Limit user agent length
}

/**
 * Rate limiting configurations for different endpoints
 */
export const rateLimitConfigs = {
  // Auth endpoints - stricter limits
  auth: {
    interval: 15 * 60 * 1000, // 15 minutes
    uniqueTokenPerInterval: 5 // 5 attempts per 15 minutes
  },
  
  // API endpoints - moderate limits
  api: {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 60 // 60 requests per minute
  },
  
  // Search endpoints - more lenient
  search: {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 120 // 120 requests per minute
  },
  
  // Sync endpoints - restricted
  sync: {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 10 // 10 requests per minute
  },
  
  // AI endpoints - limited due to cost
  ai: {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 20 // 20 requests per minute
  }
} as const

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: Awaited<ReturnType<typeof rateLimit>>) {
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
 * Rate limiting middleware wrapper for API routes
 */
export function withRateLimit(
  config: IRateLimitOptions = rateLimitConfigs.api
) {
  return async function rateLimitMiddleware(request: NextRequest) {
    const result = await rateLimit(request, config)
    
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
    
    return { success: true, headers: createRateLimitHeaders(result) }
  }
}

/**
 * Enhanced route handler with rate limiting
 */
export function withRateLimitedRoute<T extends (...args: any[]) => any>(
  handler: T,
  config?: IRateLimitOptions
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, config)
    const headers = createRateLimitHeaders(rateLimitResult)
    
    if (!rateLimitResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter
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
    
    // Call original handler
    const response = await handler(request, ...args)
    
    // Add rate limit headers to response
    if (response instanceof Response) {
      headers.forEach((value, key) => {
        response.headers.set(key, value)
      })
    }
    
    return response
  }) as T
}