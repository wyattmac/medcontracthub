import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler-next15'
import { ValidationError } from '@/lib/errors/types'
import { captureMessage, captureException, trackEvent } from '@/lib/monitoring/sentry'

// This is a test endpoint to verify Sentry integration
// Only available in development mode
export const GET = routeHandler.GET(
  async ({ request }) => {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ 
        message: 'This endpoint is only available in development' 
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const testType = searchParams.get('type') || 'random'

    if (testType === 'random') {
      // Test different error types randomly
      const errorType = Math.floor(Math.random() * 4)
      
      switch (errorType) {
        case 0:
          captureMessage('Random test message from Sentry endpoint', 'info', {
            randomType: 'message',
            endpoint: '/api/test-sentry'
          })
          return NextResponse.json({ 
            message: 'Random Sentry message sent',
            type: 'message' 
          })
        
        case 1:
          trackEvent('test', 'random_api_call', 'sentry_integration', 1)
          return NextResponse.json({ 
            message: 'Random Sentry event tracked',
            type: 'event' 
          })
        
        case 2:
          try {
            throw new ValidationError('Random test validation error')
          } catch (error) {
            captureException(error, {
              operation: 'random-test-sentry',
              metadata: { randomType: 'validation_error' }
            })
            return NextResponse.json({ 
              message: 'Random validation error captured',
              type: 'validation_error'
            })
          }
        
        default:
          throw new Error('Random unhandled test error for Sentry')
      }
    }

    // Specific test types
    switch (testType) {
      case 'message':
        captureMessage('Test message from API', 'info', {
          testType: 'message',
          endpoint: '/api/test-sentry'
        })
        return NextResponse.json({ 
          message: 'Test message sent to Sentry',
          type: 'message'
        })

      case 'error':
        try {
          throw new ValidationError('Test validation error for Sentry monitoring')
        } catch (error) {
          captureException(error, {
            operation: 'test-sentry-error',
            metadata: { testType: 'error' }
          })
          return NextResponse.json({ 
            message: 'Test error captured by Sentry',
            type: 'error'
          })
        }

      case 'event':
        trackEvent('test', 'api_call', 'sentry_integration', 1)
        return NextResponse.json({ 
          message: 'Test event tracked in Sentry',
          type: 'event'
        })

      case 'throw':
        // This will be caught by the route handler and sent to Sentry
        throw new Error('Test error thrown from API route (caught by routeHandler)')

      default:
        return NextResponse.json({ 
          message: 'Unknown test type',
          availableTypes: ['message', 'error', 'event', 'throw', 'random']
        })
    }
  },
  { requireAuth: false }
)