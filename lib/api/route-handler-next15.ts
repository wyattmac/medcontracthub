/**
 * Next.js 15 Compatible Route Handler
 * Fixes the route context type issues
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

// Fix for Next.js 15 route context
export interface RouteSegmentConfig {
  params?: Promise<any>
}

export interface IRouteContext {
  request: NextRequest
  params?: any
  user?: any
  supabase?: any
  requestId: string
  sanitizedBody?: any
  sanitizedQuery?: any
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
 * Compatible with Next.js 15 route signatures
 */
export function createRouteHandler(
  method: string,
  handler: RouteHandler,
  options: IRouteOptions = {}
) {
  // Return a function that matches Next.js 15 expectations
  return async (
    request: NextRequest,
    context?: RouteSegmentConfig
  ) => {
    const params = context?.params ? await context.params : {}
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
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      params
    })
    
    try {
      // Apply rate limiting
      if (options.rateLimit) {
        const rateLimitConfig = typeof options.rateLimit === 'string' 
          ? rateLimitConfigs[options.rateLimit]
          : options.rateLimit
          
        const rateLimitResult = await rateLimit(request, rateLimitConfig)
        
        if (!rateLimitResult.success) {
          throw new RateLimitError(
            'Too many requests',
            rateLimitResult.remaining,
            rateLimitResult.reset
          )
        }
      }
      
      // CSRF protection
      if (options.csrf?.enabled !== false && !options.csrf?.skipCSRF) {
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const csrfResult = await csrfProtection(request)
          if (!csrfResult.valid) {
            throw new AuthenticationError(
              'Invalid CSRF token',
              { reason: csrfResult.reason }
            )
          }
        }
      }

      // Initialize Supabase client
      const supabase = await createClient()
      
      // Authentication
      let user = null
      if (options.requireAuth !== false) {
        const { data: { user: authUser }, error } = await supabase.auth.getUser()
        
        if (error || !authUser) {
          throw new AuthenticationError('Authentication required')
        }
        
        user = authUser
        setUserContext({
          id: user.id,
          email: user.email || 'unknown'
        })
      }
      
      // Parse and validate request data
      let sanitizedBody: any
      
      // Body validation and sanitization
      if (options.validateBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          const rawBody = await parseJsonBody(request)
          
          // Sanitize first if enabled
          const bodyToValidate = options.sanitization?.skipSanitization === false && options.sanitization?.body
            ? sanitizeRequestBody(rawBody, options.sanitization.body)
            : rawBody
          
          // Then validate
          sanitizedBody = options.validateBody.parse(bodyToValidate)
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new ValidationError('Invalid request body', error)
          }
          throw error
        }
      }
      
      // Query validation
      let sanitizedQuery: any
      if (options.validateQuery) {
        try {
          const queryParams = Object.fromEntries(request.nextUrl.searchParams)
          sanitizedQuery = options.validateQuery.parse(queryParams)
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new ValidationError('Invalid query parameters', error)
          }
          throw error
        }
      }
      
      // Create context object
      const context: IRouteContext = {
        request,
        params,
        user,
        supabase,
        requestId,
        sanitizedBody,
        sanitizedQuery
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
async function parseJsonBody<T = any>(
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

