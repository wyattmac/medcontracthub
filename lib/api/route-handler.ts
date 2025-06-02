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
  AppError 
} from '@/lib/errors/types'
import { apiLogger } from '@/lib/errors/logger'

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
}

export interface IRouteOptions {
  requireAuth?: boolean
  validateBody?: z.ZodSchema
  validateQuery?: z.ZodSchema
  rateLimit?: {
    requests: number
    window: number // in seconds
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

      // Validate request body
      if (options.validateBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          const body = await request.json()
          await options.validateBody.parseAsync(body)
        } catch (error) {
          throw new ValidationError('Invalid request body', error)
        }
      }

      // Execute handler
      const response = await handler(context)
      
      // Add standard headers
      response.headers.set('X-Request-Id', requestId)
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
      
      // Log success
      apiLogger.info(`${method} ${request.nextUrl.pathname} completed`, {
        requestId,
        status: response.status,
        responseTime: Date.now() - startTime
      })
      
      return response
      
    } catch (error) {
      // Log error
      apiLogger.error(`${method} ${request.nextUrl.pathname} failed`, error, {
        requestId,
        responseTime: Date.now() - startTime
      })
      
      return formatErrorResponse(error, requestId)
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