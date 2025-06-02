/**
 * Central export for all error handling utilities
 */

// Export error types and classes
export * from './types'

// Export error utilities
export * from './utils'

// Export logger instances
export {
  logger,
  apiLogger,
  dbLogger,
  authLogger,
  aiLogger,
  syncLogger
} from './logger'

// Export common error patterns
export const handleApiError = (error: unknown) => {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch failed')) {
      return {
        message: 'Network connection failed. Please check your internet connection.',
        code: 'NETWORK_ERROR'
      }
    }
    
    // Timeout errors
    if (error.message.includes('timeout')) {
      return {
        message: 'Request timed out. Please try again.',
        code: 'TIMEOUT'
      }
    }
  }
  
  return {
    message: 'An unexpected error occurred.',
    code: 'UNKNOWN'
  }
}

// Export error messages
export const ErrorMessages = {
  // Authentication
  AUTH_REQUIRED: 'Please log in to continue',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  INVALID_CREDENTIALS: 'Invalid email or password',
  
  // Database
  CONNECTION_FAILED: 'Unable to connect to the database',
  QUERY_FAILED: 'Database query failed',
  
  // Validation
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_FORMAT: 'Invalid format',
  
  // API
  API_ERROR: 'API request failed',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  
  // General
  UNKNOWN_ERROR: 'An unexpected error occurred',
  TRY_AGAIN: 'Please try again',
  CONTACT_SUPPORT: 'If this problem persists, please contact support'
} as const