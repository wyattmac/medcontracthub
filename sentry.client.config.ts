import * as Sentry from '@sentry/nextjs'

// Only initialize Sentry if we have a DSN
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
    
    // Replay recording configuration
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    
    integrations: [
      Sentry.replayIntegration({
        // Mask all text content, but keep media playback
        maskAllText: true,
        blockAllMedia: false,
      }),
    ],
    
    // Environment
    environment: process.env.NODE_ENV || 'development',
    
    // Filter out non-application errors
    beforeSend(event, hint) {
      // Filter out browser extension errors
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        frame => frame.filename?.includes('extension://')
      )) {
        return null
      }
      
      // Filter out network errors from third-party services
      const error = hint.originalException
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message
        if (
          message.includes('Network request failed') ||
          message.includes('Failed to fetch') ||
          message.includes('Load failed')
        ) {
          // Only send if it's our API
          const stack = (error as Error).stack
          if (!stack?.includes('/api/')) {
            return null
          }
        }
      }
      
      return event
    },
    
    // Configure allowed URLs
    allowUrls: [
      /https:\/\/.*\.medcontracthub\.com/,
      /http:\/\/localhost:3000/,
    ],
    
    // Ignore common errors
    ignoreErrors: [
      // Browser errors
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      // Network errors
      'Network request failed',
      'NetworkError',
      'Failed to fetch',
      // User actions
      'User cancelled',
      'User denied',
      // Extensions
      'Extension context invalidated',
    ],
  })
}