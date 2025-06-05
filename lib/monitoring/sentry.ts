/**
 * Sentry Monitoring Utilities
 * Enhanced error tracking and performance monitoring for production
 */

import * as Sentry from '@sentry/nextjs'
import { AppError } from '@/lib/errors/types'

/**
 * Check if Sentry is initialized
 */
export function isSentryEnabled(): boolean {
  return !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error | AppError | unknown,
  context?: {
    userId?: string
    companyId?: string
    requestId?: string
    operation?: string
    metadata?: Record<string, any>
  }
): void {
  if (!isSentryEnabled()) return

  // Add context
  if (context) {
    Sentry.withScope(scope => {
      if (context.userId) {
        scope.setUser({ id: context.userId })
      }
      
      if (context.companyId) {
        scope.setTag('company_id', context.companyId)
      }
      
      if (context.requestId) {
        scope.setTag('request_id', context.requestId)
      }
      
      if (context.operation) {
        scope.setTag('operation', context.operation)
      }
      
      if (context.metadata) {
        scope.setContext('metadata', context.metadata)
      }
      
      // Add error-specific context if it's an AppError
      if (error instanceof AppError) {
        scope.setTag('error_code', error.code)
        scope.setTag('error_operational', error.isOperational)
        scope.setLevel(error.isOperational ? 'warning' : 'error')
        
        if (error.details) {
          scope.setContext('error_details', error.details)
        }
      }
      
      Sentry.captureException(error)
    })
  } else {
    Sentry.captureException(error)
  }
}

/**
 * Capture a message with context
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): void {
  if (!isSentryEnabled()) return

  Sentry.withScope(scope => {
    if (context) {
      scope.setContext('details', context)
    }
    
    Sentry.captureMessage(message, level)
  })
}

/**
 * Track a custom event
 */
export function trackEvent(
  category: string,
  action: string,
  label?: string,
  value?: number
): void {
  if (!isSentryEnabled()) return

  Sentry.addBreadcrumb({
    category: 'custom',
    message: `${category}: ${action}`,
    level: 'info',
    data: {
      category,
      action,
      label,
      value
    }
  })
}

/**
 * Monitor API performance
 */
export function startApiTransaction(
  name: string,
  operation: string = 'http.server'
): any | null {
  if (!isSentryEnabled()) return null

  return Sentry.startSpan({
    name,
    op: operation,
    data: {
      timestamp: new Date().toISOString()
    }
  }, () => {})
}

/**
 * Monitor database queries
 */
export function measureDatabaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  if (!isSentryEnabled()) {
    return queryFn()
  }

  return Sentry.startSpan({
    name: queryName,
    op: 'db.query'
  }, async () => {
    return await queryFn()
  })
}

/**
 * Monitor external API calls
 */
export function measureExternalApi<T>(
  apiName: string,
  endpoint: string,
  apiFn: () => Promise<T>
): Promise<T> {
  if (!isSentryEnabled()) {
    return apiFn()
  }

  return Sentry.startSpan({
    name: `${apiName}: ${endpoint}`,
    op: 'http.client'
  }, async () => {
    return await apiFn()
  })
}

/**
 * Add user context to Sentry
 */
export function setUserContext(user: {
  id: string
  email?: string
  name?: string
  companyId?: string
}): void {
  if (!isSentryEnabled()) return

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
    company_id: user.companyId
  })
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  if (!isSentryEnabled()) return
  
  Sentry.setUser(null)
}

/**
 * Add breadcrumb for better error context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
): void {
  if (!isSentryEnabled()) return

  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    timestamp: Date.now() / 1000,
    data
  })
}

/**
 * Monitor Next.js API route performance
 */
export function withSentryMonitoring<T extends (...args: any[]) => any>(
  handler: T,
  routeName: string
): T {
  if (!isSentryEnabled()) {
    return handler
  }

  return (async (...args: Parameters<T>) => {
    const transaction = startApiTransaction(routeName)
    
    try {
      const result = await handler(...args)
      transaction?.setStatus('ok')
      return result
    } catch (error) {
      transaction?.setStatus('internal_error')
      captureException(error, { operation: routeName })
      throw error
    } finally {
      transaction?.finish()
    }
  }) as T
}

/**
 * Create a Sentry-aware error boundary
 */
export function createErrorBoundary(componentName: string) {
  return {
    onError: (error: Error, errorInfo: React.ErrorInfo) => {
      captureException(error, {
        operation: `React Error Boundary: ${componentName}`,
        metadata: {
          componentStack: errorInfo.componentStack,
          digest: (errorInfo as any).digest
        }
      })
    }
  }
}