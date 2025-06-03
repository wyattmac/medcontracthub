/**
 * Tests for error types and classes
 */

import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ErrorCode
} from '@/lib/errors/types'

describe('Error Types', () => {
  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError(
        ErrorCode.INTERNAL_ERROR,
        'Test error message',
        500,
        { detail: 'test' }
      )

      expect(error.name).toBe('AppError')
      expect(error.message).toBe('Test error message')
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR)
      expect(error.statusCode).toBe(500)
      expect(error.details).toEqual({ detail: 'test' })
      expect(error.isOperational).toBe(true)
      expect(error.timestamp).toBeDefined()
      expect(new Date(error.timestamp)).toBeInstanceOf(Date)
    })

    it('should have proper stack trace', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test error')
      
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('AppError')
    })

    it('should serialize to JSON correctly', () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        400,
        { field: 'email' }
      )

      const json = error.toJSON()

      expect(json).toEqual({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        statusCode: 400,
        details: { field: 'email' },
        timestamp: error.timestamp
      })
    })
  })

  describe('AuthenticationError', () => {
    it('should create error with correct defaults', () => {
      const error = new AuthenticationError()

      expect(error.name).toBe('AuthenticationError')
      expect(error.message).toBe('Authentication failed')
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED)
      expect(error.statusCode).toBe(401)
      expect(error.isOperational).toBe(true)
    })

    it('should accept custom message and details', () => {
      const error = new AuthenticationError('Invalid token', { token: 'abc123' })

      expect(error.message).toBe('Invalid token')
      expect(error.details).toEqual({ token: 'abc123' })
    })
  })

  describe('AuthorizationError', () => {
    it('should create error with correct defaults', () => {
      const error = new AuthorizationError()

      expect(error.name).toBe('AuthorizationError')
      expect(error.message).toBe('Access denied')
      expect(error.code).toBe(ErrorCode.FORBIDDEN)
      expect(error.statusCode).toBe(403)
    })
  })

  describe('DatabaseError', () => {
    it('should create error with correct defaults', () => {
      const error = new DatabaseError()

      expect(error.name).toBe('DatabaseError')
      expect(error.message).toBe('Database operation failed')
      expect(error.code).toBe(ErrorCode.DATABASE_QUERY)
      expect(error.statusCode).toBe(500)
    })

    it('should accept custom error code', () => {
      const error = new DatabaseError(
        'Connection failed',
        ErrorCode.DATABASE_CONNECTION,
        { host: 'localhost' }
      )

      expect(error.message).toBe('Connection failed')
      expect(error.code).toBe(ErrorCode.DATABASE_CONNECTION)
      expect(error.details).toEqual({ host: 'localhost' })
    })
  })

  describe('ValidationError', () => {
    it('should create error with correct defaults', () => {
      const error = new ValidationError()

      expect(error.name).toBe('ValidationError')
      expect(error.message).toBe('Validation failed')
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(error.statusCode).toBe(400)
    })

    it('should accept validation details', () => {
      const validationDetails = {
        field: 'email',
        value: 'invalid-email',
        constraint: 'must be valid email'
      }
      const error = new ValidationError('Email validation failed', validationDetails)

      expect(error.message).toBe('Email validation failed')
      expect(error.details).toEqual(validationDetails)
    })
  })

  describe('NotFoundError', () => {
    it('should create error with correct defaults', () => {
      const error = new NotFoundError()

      expect(error.name).toBe('NotFoundError')
      expect(error.message).toBe('Resource not found')
      expect(error.code).toBe(ErrorCode.RECORD_NOT_FOUND)
      expect(error.statusCode).toBe(404)
    })

    it('should accept custom resource name', () => {
      const error = new NotFoundError('User', { id: '123' })

      expect(error.message).toBe('User not found')
      expect(error.details).toEqual({ id: '123' })
    })
  })

  describe('RateLimitError', () => {
    it('should create error with correct defaults', () => {
      const error = new RateLimitError()

      expect(error.name).toBe('RateLimitError')
      expect(error.message).toBe('Rate limit exceeded')
      expect(error.code).toBe(ErrorCode.API_RATE_LIMIT)
      expect(error.statusCode).toBe(429)
    })

    it('should accept retry after time', () => {
      const error = new RateLimitError('Too many requests', 60)

      expect(error.message).toBe('Too many requests')
      expect(error.details).toEqual({ retryAfter: 60 })
    })
  })

  describe('Error inheritance', () => {
    it('should be instance of Error', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test')
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(AppError)
    })

    it('should work with instanceof checks for specific errors', () => {
      const authError = new AuthenticationError()
      const validationError = new ValidationError()
      
      expect(authError).toBeInstanceOf(Error)
      expect(authError).toBeInstanceOf(AppError)
      expect(authError).toBeInstanceOf(AuthenticationError)
      
      expect(validationError).toBeInstanceOf(Error)
      expect(validationError).toBeInstanceOf(AppError)
      expect(validationError).toBeInstanceOf(ValidationError)
      
      expect(authError).not.toBeInstanceOf(ValidationError)
      expect(validationError).not.toBeInstanceOf(AuthenticationError)
    })
  })

  describe('Error codes', () => {
    it('should have all required error codes', () => {
      expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED')
      expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN')
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
      expect(ErrorCode.RECORD_NOT_FOUND).toBe('RECORD_NOT_FOUND')
      expect(ErrorCode.DATABASE_QUERY).toBe('DATABASE_QUERY')
      expect(ErrorCode.API_RATE_LIMIT).toBe('API_RATE_LIMIT')
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
    })
  })
})