/**
 * API Route Handler Wrapper
 * Provides consistent error handling and logging for all API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { 
  formatErrorResponse, 
  parseError,
  validateEnvironment 
} from '@/lib/errors/utils'
import { 
  AuthenticationError, 
  ValidationError,
  RateLimitError,
  AppError 
} from '@/lib/errors/types'
import { apiLogger } from '@/lib/errors/logger'
import { rateLimit, rateLimitConfigs, createRateLimitHeaders } from '@/lib/rate-limit'
import { sanitizeRequestBody } from '@/lib/security/sanitization'
import { csrfProtection } from '@/lib/security/csrf'
import { 
  startApiTransaction, 
  captureException,
  setUserContext,
  addBreadcrumb 
} from '@/lib/monitoring/sentry'

// Validate environment on module load
if (process.env.NODE_ENV === 'production') {
  try {
    validateEnvironment()
  } catch (error) {
    console.error('Environment validation failed:', error)
  }
}

export interface IRouteContext {
  request: NextRequest
  params?: any
  user?: any
  supabase?: any
  requestId: string
  sanitizedBody?: any
}

export interface IRouteOptions {
  requireAuth?: boolean
  validateBody?: z.ZodSchema
  validateQuery?: z.ZodSchema
  rateLimit?: 'auth' | 'api' | 'search' | 'sync' | 'ai' | {
    interval: number
    uniqueTokenPerInterval: number
  }
  sanitization?: {
    body?: Record<string, 'text' | 'basic' | 'rich' | 'search' | 'url' | 'filename'>
    skipSanitization?: boolean
  }
  csrf?: {
    enabled?: boolean
    skipCSRF?: boolean
  }
}

type RouteHandler = (context: IRouteContext) => Promise<NextResponse>

/**
 * Creates a wrapped route handler with error handling, auth, and validation
 */
export function createRouteHandler(
  method: string,
  handler: RouteHandler,
  options: IRouteOptions = {}
) {
  return async (request: NextRequest, { params }: { params?: any } = {}) => {
    const requestId = generateRequestId()
    const startTime = Date.now()
    const routeName = `${method} ${request.nextUrl.pathname}`
    
    // Start Sentry transaction
    const transaction = startApiTransaction(routeName)
    
    // Add breadcrumb for request tracking
    addBreadcrumb(
      `API Request: ${routeName}`,
      'http',
      {
        method,
        path: request.nextUrl.pathname,
        query: Object.fromEntries(request.nextUrl.searchParams),
        requestId
      }
    )
    
    // Log request
    apiLogger.info(`${method} ${request.nextUrl.pathname}`, {
      requestId,
      method,
      path: request.nextUrl.pathname,
      query: Object.fromEntries(request.nextUrl.searchParams),
      headers: {
        'user-agent': request.headers.get('user-agent'),
        'content-type': request.headers.get('content-type'),
        'x-forwarded-for': request.headers.get('x-forwarded-for')
      }
    })

    try {
      // Apply rate limiting if configured
      if (options.rateLimit) {
        const rateLimitConfig = typeof options.rateLimit === 'string' 
          ? rateLimitConfigs[options.rateLimit]
          : options.rateLimit
          
        const rateLimitResult = await rateLimit(request, rateLimitConfig)
        
        if (!rateLimitResult.success) {
          throw new RateLimitError(
            `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
            rateLimitResult.retryAfter
          )
        }
      }
      
      // Apply CSRF protection for state-changing requests
      if (options.csrf?.enabled !== false && !options.csrf?.skipCSRF && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const csrfResult = await csrfProtection(request)
        
        if (!csrfResult.success) {
          throw new ValidationError('CSRF token validation failed. Please refresh the page and try again.')
        }
      }
      
      // Initialize context
      const context: IRouteContext = {
        request,
        params,
        requestId
      }

      // Handle authentication if required
      if (options.requireAuth) {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          throw new AuthenticationError('Authentication required')
        }
        
        context.user = user
        context.supabase = supabase
        
        // Set user context in Sentry
        setUserContext({
          id: user.id,
          email: user.email || undefined
        })
      } else if (options.requireAuth === false) {
        // Explicitly no auth required
        context.supabase = await createClient()
      }

      // Validate query parameters
      if (options.validateQuery) {
        try {
          const query = Object.fromEntries(request.nextUrl.searchParams)
          await options.validateQuery.parseAsync(query)
        } catch (error) {
          throw new ValidationError('Invalid query parameters', error)
        }
      }

      // Validate and sanitize request body
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          let body = await request.json()
          
          // Apply sanitization unless explicitly skipped
          if (!options.sanitization?.skipSanitization) {
            body = sanitizeRequestBody(body, options.sanitization?.body)
            
            // Log sanitization activity in development
            if (process.env.NODE_ENV === 'development') {
              apiLogger.debug('Request body sanitized', {
                requestId,
                originalKeys: Object.keys(body || {}),
                sanitizationConfig: options.sanitization?.body
              })
            }
          }
          
          // Validate the sanitized body
          if (options.validateBody) {
            await options.validateBody.parseAsync(body)
          }
          
          // Add sanitized body to context for handler access
          context.sanitizedBody = body
          
        } catch (error) {
          if (error instanceof ValidationError) {
            throw error
          }
          throw new ValidationError('Invalid request body', error)
        }
      }

      // Execute handler
      const response = await handler(context)
      
      // Add standard headers
      response.headers.set('X-Request-Id', requestId)
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
      
      // Add rate limit headers if rate limiting was applied
      if (options.rateLimit) {
        const rateLimitConfig = typeof options.rateLimit === 'string' 
          ? rateLimitConfigs[options.rateLimit]
          : options.rateLimit
          
        const rateLimitResult = await rateLimit(request, rateLimitConfig)
        const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)
        
        rateLimitHeaders.forEach((value, key) => {
          response.headers.set(key, value)
        })
      }
      
      // Log success
      apiLogger.info(`${method} ${request.nextUrl.pathname} completed`, {
        requestId,
        status: response.status,
        responseTime: Date.now() - startTime
      })
      
      // Mark transaction as successful
      transaction?.setStatus('ok')
      
      return response
      
    } catch (error) {
      // Log error
      apiLogger.error(`${method} ${request.nextUrl.pathname} failed`, error, {
        requestId,
        responseTime: Date.now() - startTime
      })
      
      // Mark transaction as failed and capture error
      transaction?.setStatus('internal_error')
      captureException(error, {
        operation: routeName,
        requestId,
        metadata: {
          method,
          path: request.nextUrl.pathname,
          responseTime: Date.now() - startTime,
          query: Object.fromEntries(request.nextUrl.searchParams)
        }
      })
      
      return formatErrorResponse(error, requestId)
    } finally {
      // Always finish the transaction
      transaction?.finish()
    }
  }
}

/**
 * Helper to create standard HTTP method handlers
 */
export const routeHandler = {
  GET: (handler: RouteHandler, options?: IRouteOptions) => 
    createRouteHandler('GET', handler, options),
    
  POST: (handler: RouteHandler, options?: IRouteOptions) => 
    createRouteHandler('POST', handler, options),
    
  PUT: (handler: RouteHandler, options?: IRouteOptions) => 
    createRouteHandler('PUT', handler, options),
    
  PATCH: (handler: RouteHandler, options?: IRouteOptions) => 
    createRouteHandler('PATCH', handler, options),
    
  DELETE: (handler: RouteHandler, options?: IRouteOptions) => 
    createRouteHandler('DELETE', handler, options)
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Helper to parse JSON body safely
 */
export async function parseJsonBody<T = any>(
  request: NextRequest
): Promise<T | null> {
  try {
    const text = await request.text()
    if (!text) return null
    return JSON.parse(text)
  } catch (error) {
    throw new ValidationError('Invalid JSON body')
  }
}

/**
 * Helper to create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    offset: number
    limit: number
    total: number
  }
) {
  return NextResponse.json({
    data,
    pagination: {
      offset: pagination.offset,
      limit: pagination.limit,
      total: pagination.total,
      hasMore: pagination.offset + pagination.limit < pagination.total,
      nextOffset: pagination.offset + pagination.limit < pagination.total
        ? pagination.offset + pagination.limit
        : null
    }
  })
}