import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { routeHandler } from '@/lib/api/route-handler'
import { AppError, ErrorCode } from '@/lib/errors/types'

// This is a test endpoint to verify Sentry integration
// Only available in development mode
export const GET = routeHandler.GET(
  async () => {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ 
        message: 'This endpoint is only available in development' 
      }, { status: 403 })
    }

    // Test different error types
    const errorType = Math.floor(Math.random() * 4)

    switch (errorType) {
      case 0:
        // Test custom app error
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          'Test error from Sentry test endpoint',
          500,
          { testData: 'This is test metadata' }
        )
      
      case 1:
        // Test unhandled error
        throw new Error('Unhandled test error for Sentry')
      
      case 2:
        // Test Sentry message
        Sentry.captureMessage('Test message from Sentry test endpoint', 'warning')
        return NextResponse.json({ 
          message: 'Sentry message sent',
          type: 'message' 
        })
      
      default:
        // Test Sentry exception
        Sentry.captureException(new Error('Manual test exception for Sentry'), {
          tags: { test: true },
          level: 'error',
        })
        return NextResponse.json({ 
          message: 'Sentry exception sent',
          type: 'exception' 
        })
    }
  },
  { requireAuth: false }
)