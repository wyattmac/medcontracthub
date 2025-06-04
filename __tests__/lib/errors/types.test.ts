/**
 * Error types tests
 */

import {
  AppError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  ExternalAPIError,
  RateLimitError,
  ErrorCode
} from '@/lib/errors/types'

describe('Error Types', () => {
  describe('AppError', () => {
    it('should create basic AppError', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test error')
      
      expect(error.name).toBe('AppError')
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('INTERNAL_ERROR')
      expect(error.statusCode).toBe(500)
      expect(error.isOperational).toBe(true)
      expect(error.details).toBeUndefined()
    })

    it('should create AppError with custom status and details', () => {
      const details = { field: 'email', reason: 'invalid format' }
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR, 
        'Invalid input', 
        400, 
        details
      )
      
      expect(error.statusCode).toBe(400)
      expect(error.details).toEqual(details)
    })

    it('should mark as non-operational when specified', () => {
      const error = new AppError(
        ErrorCode.INTERNAL_ERROR, 
        'System error', 
        500, 
        undefined, 
        false
      )
      
      expect(error.isOperational).toBe(false)
    })
  })

  describe('AuthenticationError', () => {
    it('should create authentication error with correct defaults', () => {
      const error = new AuthenticationError('Access denied')
      
      expect(error.name).toBe('AuthenticationError')
      expect(error.code).toBe('UNAUTHORIZED')
      expect(error.statusCode).toBe(401)
      expect(error.message).toBe('Access denied')
    })

    it('should accept details parameter', () => {
      const details = { reason: 'invalid_token' }
      const error = new AuthenticationError('Token invalid', details)
      expect(error.details).toEqual(details)
    })
  })

  describe('ValidationError', () => {
    it('should create validation error with correct defaults', () => {
      const error = new ValidationError('Invalid email')
      
      expect(error.name).toBe('ValidationError')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.statusCode).toBe(400)
      expect(error.message).toBe('Invalid email')
    })

    it('should include validation details', () => {
      const validationDetails = { field: 'password', min: 8 }
      const error = new ValidationError('Password too short', validationDetails)
      
      expect(error.details).toEqual(validationDetails)
    })
  })

  describe('NotFoundError', () => {
    it('should create not found error', () => {
      const error = new NotFoundError('User')
      
      expect(error.name).toBe('NotFoundError')
      expect(error.code).toBe('RECORD_NOT_FOUND')
      expect(error.statusCode).toBe(404)
      expect(error.message).toBe('User not found')
    })

    it('should create generic not found error', () => {
      const error = new NotFoundError()
      expect(error.message).toBe('Resource not found')
    })
  })

  describe('DatabaseError', () => {
    it('should create database error', () => {
      const error = new DatabaseError('Connection failed')
      
      expect(error.name).toBe('DatabaseError')
      expect(error.code).toBe('DATABASE_QUERY')
      expect(error.statusCode).toBe(500)
      expect(error.message).toBe('Connection failed')
    })
    
    it('should accept custom error code', () => {
      const error = new DatabaseError('Timeout', 'DATABASE_TIMEOUT' as any)
      expect(error.code).toBe('DATABASE_TIMEOUT')
    })
  })

  describe('ExternalAPIError', () => {
    it('should create external API error', () => {
      const error = new ExternalAPIError('SAM.gov', 'Rate limit exceeded')
      
      expect(error.name).toBe('ExternalAPIError')
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR')
      expect(error.statusCode).toBe(502)
      expect(error.message).toBe('SAM.gov: Rate limit exceeded')
    })
  })

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError('Too many requests', 60)
      
      expect(error.name).toBe('RateLimitError')
      expect(error.code).toBe('API_RATE_LIMIT')
      expect(error.statusCode).toBe(429)
      expect(error.message).toBe('Too many requests')
      expect(error.details).toEqual({ retryAfter: 60 })
    })
  })

  describe('Error inheritance', () => {
    it('should inherit from Error properly', () => {
      const error = new ValidationError('Test')
      
      expect(error instanceof Error).toBe(true)
      expect(error instanceof AppError).toBe(true)
      expect(error instanceof ValidationError).toBe(true)
    })

    it('should have proper stack trace', () => {
      const error = new AuthenticationError('Test')
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('AuthenticationError')
    })
  })
})