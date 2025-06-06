/**
 * Test route to demonstrate enhanced error handling
 * This shows how errors are reported with full context
 */

import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'
import { z } from 'zod'
import { AppError, ValidationError, ExternalAPIError, ErrorCode } from '@/lib/errors/types'
import { NextResponse } from 'next/server'

const testQuerySchema = z.object({
  type: z.enum(['validation', 'auth', 'database', 'external', 'rate-limit', 'unknown']).optional(),
  throwError: z.string().optional().transform(val => val === 'true')
})

export const GET = enhancedRouteHandler.GET(
  async ({ user, supabase, sanitizedQuery }, request) => {
    const { type = 'unknown', throwError = false } = sanitizedQuery || {}
    
    // Simulate different error types for testing
    if (throwError) {
      switch (type) {
        case 'validation':
          throw new ValidationError('Test validation error', {
            errors: [
              { path: ['email'], message: 'Invalid email format' },
              { path: ['age'], message: 'Must be at least 18' }
            ]
          })
          
        case 'auth':
          throw new AppError(
            ErrorCode.UNAUTHORIZED,
            'Test authentication error',
            401,
            { hint: 'Try logging in again' }
          )
          
        case 'database':
          // Simulate Supabase error
          throw new AppError(
            ErrorCode.DATABASE_CONNECTION,
            'Test database error',
            500,
            {
              supabaseError: {
                message: 'connection timeout',
                code: 'PGRST301',
                details: 'Unable to connect to database'
              },
              hint: 'Check your Supabase connection'
            }
          )
          
        case 'external':
          throw new ExternalAPIError(
            'SAM.gov',
            'API quota exceeded',
            ErrorCode.API_RATE_LIMIT,
            {
              samGovError: {
                quotaUsed: 1000,
                quotaLimit: 1000,
                resetTime: new Date(Date.now() + 3600000).toISOString()
              },
              hint: 'Wait for quota reset or upgrade your plan'
            }
          )
          
        case 'rate-limit':
          throw new AppError(
            ErrorCode.API_RATE_LIMIT,
            'Test rate limit error',
            429,
            { retryAfter: 60 }
          )
          
        default:
          // Simulate unexpected error
          const obj: any = null
          return obj.someProperty // This will throw TypeError
      }
    }
    
    // Success response with debugging info
    return NextResponse.json({
      success: true,
      message: 'Test endpoint working correctly',
      errorTypes: ['validation', 'auth', 'database', 'external', 'rate-limit', 'unknown'],
      usage: {
        example: '/api/test-error?type=validation&throwError=true',
        description: 'Add throwError=true to trigger an error of the specified type'
      },
      context: {
        user: user ? { id: user.id, email: user.email } : null,
        authenticated: !!user,
        environment: process.env.NODE_ENV
      }
    })
  },
  {
    requireAuth: false, // Allow testing without auth
    validateQuery: testQuerySchema,
    rateLimit: 'api'
  }
)