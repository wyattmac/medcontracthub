import * as Sentry from '@sentry/nextjs'

// Only initialize Sentry if we have a DSN
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
    
    // Environment
    environment: process.env.NODE_ENV || 'development',
    
    // Configure integrations
    integrations: [
      // Automatically instrument Node.js libraries and frameworks
      ...Sentry.getDefaultIntegrations(),
    ],
    
    // Filter transactions
    beforeSendTransaction(transaction) {
      // Don't track health check endpoints
      if (transaction.name === 'GET /api/health') {
        return null
      }
      return transaction
    },
    
    // Filter out non-application errors
    beforeSend(event, hint) {
      // Add user context if available
      if (event.request?.headers) {
        const userId = event.request.headers['x-user-id']
        if (userId) {
          event.user = { id: userId as string }
        }
      }
      
      // Filter out expected errors
      const error = hint.originalException
      if (error && typeof error === 'object' && 'code' in error) {
        // Don't send validation errors (they're expected)
        if ((error as any).code === 'VALIDATION_ERROR') {
          return null
        }
      }
      
      return event
    },
    
    // Server-specific options
    serverName: process.env.VERCEL_URL || 'localhost',
    
    // Profiling (only in production)
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  })
}