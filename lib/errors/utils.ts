/**
 * Error Handling Utilities
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { 
  AppError, 
  ErrorCode, 
  IErrorResponse,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  ExternalAPIError
} from './types'

/**
 * Formats error for API response
 */
export function formatErrorResponse(
  error: unknown,
  requestId?: string
): NextResponse<IErrorResponse> {
  const errorResponse = parseError(error, requestId)
  
  // Log error for monitoring
  logError(error, errorResponse)
  
  // Handle test environment where NextResponse.json might not be available
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return new Response(JSON.stringify({ error: errorResponse }), {
      status: errorResponse.statusCode || 500,
      headers: { 'Content-Type': 'application/json' }
    }) as NextResponse<IErrorResponse>
  }
  
  return NextResponse.json(
    { error: errorResponse },
    { status: errorResponse.statusCode || 500 }
  )
}

/**
 * Parses various error types into consistent format
 */
export function parseError(error: unknown, requestId?: string): any {
  // Handle AppError instances
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp,
      requestId,
      statusCode: error.statusCode
    }
  }
  
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = new ValidationError('Input validation failed', {
      errors: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    })
    return parseError(validationError, requestId)
  }
  
  // Handle Supabase errors
  if (isSupabaseError(error)) {
    const supabaseError = error as any
    const code = mapSupabaseErrorCode(supabaseError.code)
    const message = supabaseError.message || 'Database operation failed'
    
    if (supabaseError.code === 'PGRST301' || supabaseError.code === '42501') {
      return parseError(new AuthenticationError(message), requestId)
    }
    
    return parseError(new DatabaseError(message, code, supabaseError), requestId)
  }
  
  // Handle native errors
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('fetch failed')) {
      return parseError(
        new ExternalAPIError('Network', 'Connection failed', ErrorCode.API_CONNECTION),
        requestId
      )
    }
    
    if (error.message.includes('timeout')) {
      return parseError(
        new AppError(ErrorCode.API_TIMEOUT, 'Operation timed out', 504),
        requestId
      )
    }
    
    return {
      code: ErrorCode.INTERNAL_ERROR,
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId,
      statusCode: 500
    }
  }
  
  // Handle unknown errors
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: 'An unexpected error occurred',
    details: error,
    timestamp: new Date().toISOString(),
    requestId,
    statusCode: 500
  }
}

/**
 * Checks if error is from Supabase
 */
function isSupabaseError(error: any): boolean {
  return error && (
    error.code?.startsWith('PGRST') ||
    error.code?.startsWith('42') ||
    error.details?.includes('PostgreSQL') ||
    error.hint !== undefined
  )
}

/**
 * Maps Supabase error codes to our error codes
 */
function mapSupabaseErrorCode(code: string): ErrorCode {
  const codeMap: Record<string, ErrorCode> = {
    'PGRST301': ErrorCode.UNAUTHORIZED,
    '42501': ErrorCode.FORBIDDEN,
    '23505': ErrorCode.DUPLICATE_RECORD,
    '23503': ErrorCode.VALIDATION_ERROR,
    '42P01': ErrorCode.DATABASE_QUERY,
    '08P01': ErrorCode.DATABASE_CONNECTION,
    '57014': ErrorCode.DATABASE_TIMEOUT
  }
  
  return codeMap[code] || ErrorCode.DATABASE_QUERY
}

/**
 * Logs error for monitoring
 */
export function logError(error: unknown, parsedError?: any): void {
  const logLevel = getErrorLogLevel(error)
  const errorInfo = {
    timestamp: new Date().toISOString(),
    error: parsedError || parseError(error),
    stack: error instanceof Error ? error.stack : undefined,
    environment: process.env.NODE_ENV
  }
  
  if (logLevel === 'error') {
    console.error('[ERROR]', JSON.stringify(errorInfo, null, 2))
  } else {
    console.warn('[WARNING]', JSON.stringify(errorInfo, null, 2))
  }
  
  // Send to monitoring service in production
  if (process.env.NODE_ENV === 'production') {
    sendToMonitoring(errorInfo)
  }
}

/**
 * Determines error severity for logging
 */
function getErrorLogLevel(error: unknown): 'error' | 'warning' {
  if (error instanceof AppError) {
    // Client errors are warnings
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return 'warning'
    }
    // Non-operational errors are always errors
    if (!error.isOperational) {
      return 'error'
    }
  }
  return 'error'
}

/**
 * Creates a safe error handler for async route handlers
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      const [request] = args
      const requestId = request?.headers?.get('x-request-id') || 
                       `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      return formatErrorResponse(error, requestId)
    }
  }) as T
}

/**
 * Send error to monitoring service (Sentry)
 */
function sendToMonitoring(errorInfo: any): void {
  try {
    // Server-side
    if (typeof window === 'undefined') {
      const Sentry = require('@sentry/nextjs')
      Sentry.captureException(errorInfo.error || new Error(errorInfo.message || 'Unknown error'), {
        level: 'error',
        extra: errorInfo,
      })
    } else if ((window as any).Sentry) {
      // Client-side
      const Sentry = (window as any).Sentry
      Sentry.captureException(errorInfo.error || new Error(errorInfo.message || 'Unknown error'), {
        level: 'error',
        extra: errorInfo,
      })
    }
  } catch (e) {
    // Silently fail if Sentry is not available
    console.error('[Sentry Error]', e)
  }
}

/**
 * Validates required environment variables
 */
export function validateEnvironment(): void {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SAM_GOV_API_KEY',
    'ANTHROPIC_API_KEY'
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new AppError(
      ErrorCode.MISSING_ENV_VAR,
      `Missing required environment variables: ${missing.join(', ')}`,
      500,
      { missing },
      false // Non-operational error
    )
  }
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T = any>(
  json: string,
  fallback?: T
): T | undefined {
  try {
    return JSON.parse(json) as T
  } catch (error) {
    logError(new ValidationError('Invalid JSON', { json: json.substring(0, 100) }))
    return fallback
  }
}

/**
 * Retry helper for external API calls
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    backoffFactor?: number
    shouldRetry?: (error: any) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = (error) => {
      // Retry on network errors or 5xx status codes
      return error.code === 'ECONNREFUSED' ||
             error.code === 'ETIMEDOUT' ||
             (error.statusCode >= 500 && error.statusCode < 600)
    }
  } = options
  
  let lastError: any
  let delay = initialDelay
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error
      }
      
      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * backoffFactor, maxDelay)
    }
  }
  
  throw lastError
}