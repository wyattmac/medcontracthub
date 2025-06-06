/**
 * Enhanced Error Reporter for Development
 * Provides detailed error context for Claude Code and developers
 */

import { AppError, ErrorCode } from './types'
import { logger } from './logger'

interface ErrorContext {
  // Request context
  url?: string
  method?: string
  headers?: Record<string, string>
  query?: Record<string, any>
  body?: any
  
  // User context
  userId?: string
  userEmail?: string
  companyId?: string
  subscription?: string
  
  // System context
  environment?: string
  version?: string
  timestamp?: string
  requestId?: string
  
  // Error details
  stack?: string
  cause?: any
  componentStack?: string
  errorBoundary?: string
  
  // Additional debug info
  supabaseError?: any
  stripeError?: any
  samGovError?: any
  redisError?: any
}

export class ErrorReporter {
  private static instance: ErrorReporter
  private context: Map<string, any> = new Map()

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  /**
   * Set global context that will be included in all error reports
   */
  setGlobalContext(key: string, value: any) {
    this.context.set(key, value)
  }

  /**
   * Report error with full context
   */
  report(error: Error | AppError, context?: ErrorContext) {
    const errorReport = this.createErrorReport(error, context)
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      this.logDevelopmentError(errorReport)
    }
    
    // Log to monitoring service
    logger.error(errorReport.message, errorReport)
    
    // Send to Sentry if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          errorReport
        }
      })
    }
    
    return errorReport
  }

  /**
   * Create detailed error report
   */
  private createErrorReport(error: Error | AppError, context?: ErrorContext) {
    const isAppError = error instanceof AppError
    
    const report = {
      // Basic error info
      message: error.message,
      name: error.name,
      code: isAppError ? error.code : ErrorCode.UNKNOWN_ERROR,
      statusCode: isAppError ? error.statusCode : 500,
      timestamp: new Date().toISOString(),
      
      // Error details
      stack: error.stack,
      cause: (error as any).cause,
      details: isAppError ? error.details : undefined,
      
      // Context
      ...context,
      
      // Global context
      globalContext: Object.fromEntries(this.context),
      
      // Environment
      environment: {
        nodeEnv: process.env.NODE_ENV,
        isBrowser: typeof window !== 'undefined',
        isServer: typeof window === 'undefined',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
      },
      
      // Helpful debugging info for Claude Code
      debugging: {
        hint: this.getDebuggingHint(error),
        possibleCauses: this.getPossibleCauses(error),
        suggestedActions: this.getSuggestedActions(error),
        relatedFiles: this.getRelatedFiles(error)
      }
    }
    
    return report
  }

  /**
   * Get debugging hint based on error type
   */
  private getDebuggingHint(error: Error | AppError): string {
    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCode.DATABASE_CONNECTION:
          return 'Check Supabase connection and environment variables'
        case ErrorCode.API_RATE_LIMIT:
          return 'Rate limit exceeded - implement backoff or caching'
        case ErrorCode.MISSING_ENV_VAR:
          return 'Missing environment variable - check .env files'
        case ErrorCode.EXTERNAL_SERVICE_ERROR:
          return 'External API failed - check API keys and service status'
        default:
          return 'Check error details and stack trace'
      }
    }
    
    // Check for common error patterns
    if (error.message.includes('Supabase')) {
      return 'Supabase error - check connection, RLS policies, and auth'
    }
    if (error.message.includes('fetch')) {
      return 'Network error - check API endpoints and CORS'
    }
    if (error.message.includes('undefined')) {
      return 'Undefined error - check for missing null checks'
    }
    
    return 'Unknown error - check stack trace and logs'
  }

  /**
   * Get possible causes for the error
   */
  private getPossibleCauses(error: Error | AppError): string[] {
    const causes: string[] = []
    
    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCode.DATABASE_CONNECTION:
          causes.push(
            'Invalid Supabase URL or keys',
            'Network connectivity issues',
            'Supabase service down',
            'SSL/TLS certificate issues'
          )
          break
        case ErrorCode.UNAUTHORIZED:
          causes.push(
            'User not logged in',
            'Session expired',
            'Invalid auth token',
            'Missing authentication headers'
          )
          break
        case ErrorCode.VALIDATION_ERROR:
          causes.push(
            'Invalid input data',
            'Missing required fields',
            'Data type mismatch',
            'Schema validation failed'
          )
          break
      }
    }
    
    // Generic causes based on error message
    if (error.message.includes('Cannot read')) {
      causes.push('Attempting to access property of null/undefined')
    }
    if (error.message.includes('Network')) {
      causes.push('Network connectivity issues', 'CORS errors', 'Invalid URL')
    }
    
    return causes
  }

  /**
   * Get suggested actions to fix the error
   */
  private getSuggestedActions(error: Error | AppError): string[] {
    const actions: string[] = []
    
    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCode.DATABASE_CONNECTION:
          actions.push(
            'Verify NEXT_PUBLIC_SUPABASE_URL in .env',
            'Check SUPABASE_SERVICE_ROLE_KEY',
            'Test connection with supabase.auth.getSession()',
            'Check Docker logs: docker logs medcontract-dev'
          )
          break
        case ErrorCode.API_RATE_LIMIT:
          actions.push(
            'Implement exponential backoff',
            'Add Redis caching',
            'Check rate limit headers',
            'Upgrade API plan if needed'
          )
          break
        case ErrorCode.MISSING_ENV_VAR:
          actions.push(
            'Check .env.local file exists',
            'Copy from .env.example',
            'Restart dev server after adding env vars',
            'Check Docker environment variables'
          )
          break
      }
    }
    
    // Generic actions
    actions.push(
      'Check browser console for additional errors',
      'View server logs: docker logs -f medcontract-dev',
      'Check network tab in browser DevTools'
    )
    
    return actions
  }

  /**
   * Get related files that might need to be checked
   */
  private getRelatedFiles(error: Error | AppError): string[] {
    const files: string[] = []
    
    // Extract file paths from stack trace
    if (error.stack) {
      const fileMatches = error.stack.matchAll(/at\s+.*?\s+\((.*?:\d+:\d+)\)/g)
      for (const match of fileMatches) {
        const filePath = match[1]
        if (filePath.includes('/app/') || filePath.includes('/lib/')) {
          files.push(filePath)
        }
      }
    }
    
    // Add common files based on error type
    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCode.DATABASE_CONNECTION:
          files.push(
            'lib/supabase/client.ts',
            'lib/supabase/server.ts',
            '.env.local'
          )
          break
        case ErrorCode.API_RATE_LIMIT:
          files.push(
            'lib/api/route-handler.ts',
            'lib/rate-limit.ts',
            'lib/redis/rate-limit.ts'
          )
          break
      }
    }
    
    return [...new Set(files)] // Remove duplicates
  }

  /**
   * Log formatted error for development
   */
  private logDevelopmentError(report: any) {
    console.group(`🚨 Error: ${report.message}`)
    
    console.log('%cError Details', 'color: red; font-weight: bold')
    console.table({
      Code: report.code,
      Status: report.statusCode,
      Time: report.timestamp
    })
    
    if (report.debugging.hint) {
      console.log('%cDebugging Hint', 'color: orange; font-weight: bold')
      console.log(report.debugging.hint)
    }
    
    if (report.debugging.possibleCauses.length > 0) {
      console.log('%cPossible Causes', 'color: yellow; font-weight: bold')
      report.debugging.possibleCauses.forEach((cause: string, i: number) => {
        console.log(`${i + 1}. ${cause}`)
      })
    }
    
    if (report.debugging.suggestedActions.length > 0) {
      console.log('%cSuggested Actions', 'color: green; font-weight: bold')
      report.debugging.suggestedActions.forEach((action: string, i: number) => {
        console.log(`${i + 1}. ${action}`)
      })
    }
    
    if (report.debugging.relatedFiles.length > 0) {
      console.log('%cRelated Files', 'color: blue; font-weight: bold')
      report.debugging.relatedFiles.forEach((file: string) => {
        console.log(`📄 ${file}`)
      })
    }
    
    if (report.stack) {
      console.log('%cStack Trace', 'color: gray; font-weight: bold')
      console.log(report.stack)
    }
    
    console.groupEnd()
  }
}

// Export singleton instance
export const errorReporter = ErrorReporter.getInstance()