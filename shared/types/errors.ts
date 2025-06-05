/**
 * Shared Error Types
 * Consistent error handling across the application
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
    this.name = 'ForbiddenError'
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, error?: any) {
    super(message, 'DATABASE_ERROR', 500, error)
    this.name = 'DatabaseError'
  }
}

export class ExternalAPIError extends AppError {
  constructor(service: string, error?: any) {
    super(`External API error: ${service}`, 'EXTERNAL_API_ERROR', 502, error)
    this.name = 'ExternalAPIError'
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', 429, { retryAfter })
    this.name = 'RateLimitError'
  }
}