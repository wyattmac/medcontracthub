/**
 * Application Error Types and Classes
 * Provides structured error handling across the application
 */

export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // Database errors
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  DATABASE_QUERY = 'DATABASE_QUERY',
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  
  // API errors
  API_CONNECTION = 'API_CONNECTION',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_TIMEOUT = 'API_TIMEOUT',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Configuration errors
  MISSING_ENV_VAR = 'MISSING_ENV_VAR',
  INVALID_CONFIG = 'INVALID_CONFIG',
  
  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

export interface IErrorDetails {
  code: ErrorCode
  message: string
  statusCode: number
  details?: any
  timestamp?: string
  requestId?: string
  path?: string
  method?: string
}

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: any
  public readonly timestamp: string
  public readonly isOperational: boolean

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.timestamp = new Date().toISOString()
    this.isOperational = isOperational
    
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON(): IErrorDetails {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    }
  }
}

// Specific error classes
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super(ErrorCode.UNAUTHORIZED, message, 401, details)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', details?: any) {
    super(ErrorCode.FORBIDDEN, message, 403, details)
  }
}

export class DatabaseError extends AppError {
  context?: any
  
  constructor(
    message: string = 'Database operation failed',
    code: ErrorCode = ErrorCode.DATABASE_QUERY,
    details?: any
  ) {
    super(code, message, 500, details)
    this.context = details
  }
}

export class ValidationError extends AppError {
  errors?: any[]
  
  constructor(message: string = 'Validation failed', errors?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, errors)
    this.errors = Array.isArray(errors) ? errors : errors ? [errors] : []
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: any) {
    super(ErrorCode.RECORD_NOT_FOUND, `${resource} not found`, 404, details)
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string = 'Configuration error', details?: any) {
    super(ErrorCode.INVALID_CONFIG, message, 500, details, false)
  }
}

export class ExternalAPIError extends AppError {
  constructor(
    service: string,
    message: string = 'External service error',
    code: ErrorCode = ErrorCode.EXTERNAL_SERVICE_ERROR,
    details?: any
  ) {
    super(code, `${service}: ${message}`, 502, details)
  }
}

// Alias for backward compatibility
export { ExternalAPIError as ExternalServiceError }

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(
      ErrorCode.API_RATE_LIMIT,
      message,
      429,
      { retryAfter }
    )
  }
}

export class QuotaExceededError extends AppError {
  constructor(message: string = 'API quota exceeded', retryAfter?: number, details?: any) {
    super(
      ErrorCode.API_RATE_LIMIT,
      message,
      429,
      { retryAfter, ...details }
    )
  }
}

// Error response type for API routes
export interface IErrorResponse {
  error: {
    code: ErrorCode
    message: string
    details?: any
    timestamp: string
    requestId?: string
  }
}