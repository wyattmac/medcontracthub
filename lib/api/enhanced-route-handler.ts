/**
 * Enhanced Route Handler with Comprehensive Error Reporting
 * Provides detailed error context for Claude Code and debugging
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { AppError, ValidationError, AuthenticationError, ErrorCode } from '@/lib/errors/types'
import { errorReporter } from '@/lib/errors/error-reporter'
import { rateLimit, rateLimitConfigs } from '@/lib/rate-limit'
import { sanitizeApiInput } from '@/lib/security/sanitization'
import { verifyCSRFToken } from '@/lib/security/csrf'
import { logger } from '@/lib/errors/logger'
import type { User } from '@supabase/supabase-js'

interface RouteOptions {
  requireAuth?: boolean
  requireAdmin?: boolean
  rateLimit?: 'api' | 'auth' | 'public'
  validateQuery?: z.ZodSchema
  validateBody?: z.ZodSchema
  requireCSRF?: boolean
}

interface RouteContext {
  user: User | null
  supabase: ReturnType<typeof createClient>
  requestId: string
  sanitizedQuery?: any
  sanitizedBody?: any
}

type RouteHandler = (context: RouteContext, request: NextRequest) => Promise<Response>

class EnhancedRouteHandler {
  private async handleRequest(
    request: NextRequest,
    handler: RouteHandler,
    options: RouteOptions = {}
  ): Promise<Response> {
    const requestId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()
    let user: User | null = null
    
    try {
      // Set up error reporter context
      errorReporter.setGlobalContext('requestId', requestId)
      errorReporter.setGlobalContext('url', request.url)
      errorReporter.setGlobalContext('method', request.method)
      
      // Rate limiting
      if (options.rateLimit) {
        const config = rateLimitConfigs[options.rateLimit]
        const { success, remaining, reset } = await rateLimit(request, config)
        
        if (!success) {
          throw new AppError(
            ErrorCode.API_RATE_LIMIT,
            'Too many requests',
            429,
            { remaining, reset }
          )
        }
      }

      // CSRF verification for mutations
      if (options.requireCSRF && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        const token = request.headers.get('x-csrf-token')
        if (!token || !verifyCSRFToken(token)) {
          throw new AppError(
            ErrorCode.FORBIDDEN,
            'Invalid CSRF token',
            403,
            { hint: 'Ensure x-csrf-token header is included' }
          )
        }
      }

      // Initialize Supabase client
      const supabase = await createClient()
      
      // Authentication
      if (options.requireAuth || options.requireAdmin) {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !authUser) {
          throw new AuthenticationError(
            'Authentication required',
            { 
              error: authError?.message,
              hint: 'Check if user is logged in and session is valid'
            }
          )
        }
        
        user = authUser
        errorReporter.setGlobalContext('userId', user.id)
        errorReporter.setGlobalContext('userEmail', user.email)
        
        // Admin check
        if (options.requireAdmin) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
            
          if (profile?.role !== 'admin') {
            throw new AppError(
              ErrorCode.FORBIDDEN,
              'Admin access required',
              403,
              { userId: user.id, role: profile?.role }
            )
          }
        }
      }

      // Parse and validate request data
      let sanitizedQuery: any
      let sanitizedBody: any
      
      // Query validation
      if (options.validateQuery) {
        const query = Object.fromEntries(new URL(request.url).searchParams)
        const validationResult = options.validateQuery.safeParse(query)
        
        if (!validationResult.success) {
          throw new ValidationError(
            'Invalid query parameters',
            {
              errors: validationResult.error.errors,
              received: query,
              hint: 'Check query parameter types and required fields'
            }
          )
        }
        
        sanitizedQuery = sanitizeApiInput(validationResult.data)
      }
      
      // Body validation
      if (options.validateBody && request.body) {
        try {
          const body = await request.json()
          const validationResult = options.validateBody.safeParse(body)
          
          if (!validationResult.success) {
            throw new ValidationError(
              'Invalid request body',
              {
                errors: validationResult.error.errors,
                received: body,
                hint: 'Check request body structure and data types'
              }
            )
          }
          
          sanitizedBody = sanitizeApiInput(validationResult.data)
        } catch (error) {
          if (error instanceof ValidationError) throw error
          
          throw new ValidationError(
            'Invalid JSON in request body',
            {
              error: (error as Error).message,
              hint: 'Ensure request body is valid JSON'
            }
          )
        }
      }

      // Execute handler
      const context: RouteContext = {
        user,
        supabase,
        requestId,
        sanitizedQuery,
        sanitizedBody
      }
      
      const response = await handler(context, request)
      
      // Log successful request
      const duration = Date.now() - startTime
      logger.info('API request completed', {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
        duration,
        userId: user?.id
      })
      
      return response
      
    } catch (error) {
      // Enhanced error reporting
      const errorReport = errorReporter.report(error as Error, {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        requestId,
        userId: user?.id,
        userEmail: user?.email,
        environment: process.env.NODE_ENV,
        
        // Add specific error context based on error type
        ...(error instanceof AppError && {
          supabaseError: error.details?.supabaseError,
          stripeError: error.details?.stripeError,
          samGovError: error.details?.samGovError,
          redisError: error.details?.redisError
        })
      })
      
      // Determine status code
      const statusCode = error instanceof AppError ? error.statusCode : 500
      
      // Create error response
      const errorResponse = {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_ERROR,
          requestId,
          timestamp: new Date().toISOString(),
          
          // Include debugging info in development
          ...(process.env.NODE_ENV === 'development' && {
            debugging: errorReport.debugging,
            stack: (error as Error).stack,
            details: error instanceof AppError ? error.details : undefined
          })
        }
      }
      
      // Log error
      const duration = Date.now() - startTime
      logger.error('API request failed', {
        ...errorResponse.error,
        duration,
        path: new URL(request.url).pathname,
        userId: user?.id
      })
      
      return NextResponse.json(errorResponse, { status: statusCode })
    }
  }

  // HTTP method handlers
  GET(handler: RouteHandler, options?: RouteOptions) {
    return (request: NextRequest) => this.handleRequest(request, handler, options)
  }

  POST(handler: RouteHandler, options?: RouteOptions) {
    return (request: NextRequest) => this.handleRequest(
      request, 
      handler, 
      { requireCSRF: true, ...options }
    )
  }

  PUT(handler: RouteHandler, options?: RouteOptions) {
    return (request: NextRequest) => this.handleRequest(
      request, 
      handler, 
      { requireCSRF: true, ...options }
    )
  }

  PATCH(handler: RouteHandler, options?: RouteOptions) {
    return (request: NextRequest) => this.handleRequest(
      request, 
      handler, 
      { requireCSRF: true, ...options }
    )
  }

  DELETE(handler: RouteHandler, options?: RouteOptions) {
    return (request: NextRequest) => this.handleRequest(
      request, 
      handler, 
      { requireCSRF: true, ...options }
    )
  }
}

export const enhancedRouteHandler = new EnhancedRouteHandler()

// Helper function to wrap existing handlers
export function wrapHandler(
  handler: (req: NextRequest) => Promise<Response>,
  options?: RouteOptions
) {
  return enhancedRouteHandler.GET(
    async (context, request) => {
      // Set up context in request for backward compatibility
      (request as any).context = context
      return handler(request)
    },
    options
  )
}