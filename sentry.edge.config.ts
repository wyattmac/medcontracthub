import * as Sentry from '@sentry/nextjs'

// Only initialize Sentry if we have a DSN
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    
    // Adjust this value in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
    
    // Environment
    environment: process.env.NODE_ENV || 'development',
    
    // Filter out non-application errors
    beforeSend(event, hint) {
      // Add request context
      if (event.request?.headers) {
        const requestId = event.request.headers['x-request-id']
        if (requestId) {
          event.tags = { ...event.tags, requestId: requestId as string }
        }
      }
      
      return event
    },
  })
}