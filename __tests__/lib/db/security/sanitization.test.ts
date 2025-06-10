/**
 * Query Sanitization Unit Tests
 * 
 * Tests SQL injection prevention, input sanitization,
 * and data validation using Zod schemas
 */

import { QuerySanitizer, sanitizationSchemas } from '@/lib/db/security/sanitization'
import { ValidationError } from '@/lib/errors/types'

// Mock performance monitoring
jest.mock('@/lib/monitoring/performance', () => ({
  startSpan: jest.fn(() => ({
    setStatus: jest.fn(),
    finish: jest.fn()
  }))
}))

describe('QuerySanitizer', () => {
  describe('sanitizeInput', () => {
    it('should pass through safe strings', () => {
      const safeInputs = [
        'Department of Veterans Affairs',
        'medical equipment supplies',
        'user@example.com',
        '339112',
        'John O\'Brien', // Properly escaped
        'test-with-dashes',
        'test_with_underscores'
      ]

      safeInputs.forEach(input => {
        const result = QuerySanitizer.sanitizeInput(input)
        expect(result).toBe(input)
      })
    })


    it('should handle various dangerous SQL commands', () => {
      const dangerousCommands = [
        'DROP TABLE',
        'DROP DATABASE',
        'TRUNCATE TABLE',
        'DELETE FROM',
        'UPDATE users SET',
        'INSERT INTO',
        'EXEC(',
        'EXECUTE(',
        'xp_cmdshell',
        'sp_executesql'
      ]

      dangerousCommands.forEach(command => {
        const input = `normal text ${command} more text`
        expect(() => QuerySanitizer.sanitizeInput(input))
          .toThrow('Input contains potentially harmful SQL patterns')
      })
    })

    it('should allow SQL keywords in legitimate contexts', () => {
      const legitimateInputs = [
        'Department of Defense', // Contains "of"
        'Medical and Surgical Equipment', // Contains "and"
        'Select Medical Supplies Inc.', // Company name with "Select"
        'Union Medical Center', // Contains "Union"
        'Executive Order 12345' // Contains "Exec"
      ]

      legitimateInputs.forEach(input => {
        const result = QuerySanitizer.sanitizeInput(input)
        expect(result).toBe(input)
      })
    })

    it('should handle empty and null inputs', () => {
      expect(QuerySanitizer.sanitizeInput('')).toBe('')
      expect(QuerySanitizer.sanitizeInput(null as any)).toBe('')
      expect(QuerySanitizer.sanitizeInput(undefined as any)).toBe('')
    })

    it('should trim whitespace', () => {
      expect(QuerySanitizer.sanitizeInput('  test  ')).toBe('test')
      expect(QuerySanitizer.sanitizeInput('\n\ttest\n\t')).toBe('test')
    })

    it('should handle special characters appropriately', () => {
      const inputs = [
        { input: "O'Brien's Company", expected: "O'Brien's Company" },
        { input: 'Test & Co.', expected: 'Test & Co.' },
        { input: 'Price: $100,000', expected: 'Price: $100,000' },
        { input: 'email@example.com', expected: 'email@example.com' }
      ]

      inputs.forEach(({ input, expected }) => {
        expect(QuerySanitizer.sanitizeInput(input)).toBe(expected)
      })
    })
  })

  describe('sanitizeArray', () => {
    it('should sanitize all array elements', () => {
      const input = ['test1', 'test2', 'test3']
      const result = QuerySanitizer.sanitizeArray(input)
      
      expect(result).toEqual(['test1', 'test2', 'test3'])
    })

    it('should reject arrays with malicious elements', () => {
      const input = ['safe', "'; DROP TABLE users;--", 'also safe']
      
      expect(() => QuerySanitizer.sanitizeArray(input))
        .toThrow('Input contains potentially harmful SQL patterns')
    })

    it('should handle empty arrays', () => {
      expect(QuerySanitizer.sanitizeArray([])).toEqual([])
    })

    it('should filter out empty strings', () => {
      const input = ['test', '', '  ', 'value']
      const result = QuerySanitizer.sanitizeArray(input)
      
      expect(result).toEqual(['test', 'value'])
    })
  })

  describe('sanitizeObject', () => {
    it('should sanitize all object values', () => {
      const input = {
        name: 'Test Company',
        email: 'test@example.com',
        description: 'Medical supplies provider'
      }

      const result = QuerySanitizer.sanitizeObject(input)
      expect(result).toEqual(input)
    })

    it('should reject objects with malicious values', () => {
      const input = {
        name: 'Safe Name',
        hack: "'; DELETE FROM users;--"
      }

      expect(() => QuerySanitizer.sanitizeObject(input))
        .toThrow('Input contains potentially harmful SQL patterns')
    })

    it('should handle nested objects recursively', () => {
      const input = {
        company: {
          name: 'Test Co',
          address: {
            street: '123 Main St',
            city: 'Boston'
          }
        }
      }

      const result = QuerySanitizer.sanitizeObject(input)
      expect(result).toEqual(input)
    })

    it('should sanitize arrays within objects', () => {
      const input = {
        tags: ['medical', 'equipment'],
        codes: ['339112', '339113']
      }

      const result = QuerySanitizer.sanitizeObject(input)
      expect(result).toEqual(input)
    })

    it('should preserve non-string values', () => {
      const input = {
        name: 'Test',
        active: true,
        count: 42,
        date: new Date('2024-01-01'),
        nullValue: null
      }

      const result = QuerySanitizer.sanitizeObject(input)
      expect(result).toEqual(input)
    })
  })

  describe('Zod Schema Validations', () => {
    describe('emailSchema', () => {
      it('should validate correct emails', () => {
        const validEmails = [
        'test@example.com',
        'user.name@company.co.uk',
        'admin+tag@domain.org'
      ]

      validEmails.forEach(email => {
        const result = sanitizationSchemas.email.parse(email)
        expect(result).toBe(email.toLowerCase())
      })
    })

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        "user'; DROP TABLE users;--@example.com"
      ]

      invalidEmails.forEach(email => {
        expect(() => sanitizationSchemas.email.parse(email)).toThrow()
      })
    })
  })

  describe('phoneSchema', () => {
    it('should validate correct phone numbers', () => {
      const validPhones = [
        '(555) 123-4567',
        '555-123-4567',
        '5551234567',
        '+1-555-123-4567'
      ]

      validPhones.forEach(phone => {
        const result = sanitizationSchemas.phone.parse(phone)
        expect(result).toBeTruthy()
      })
    })

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '',
        'not-a-phone',
        '(555) DROP TABLE',
        'abc-def-ghij'
      ]

      invalidPhones.forEach(phone => {
        expect(() => sanitizationSchemas.phone.parse(phone)).toThrow()
      })
    })
  })

  describe('uuidSchema', () => {
    it('should validate correct UUIDs', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        '550e8400-e29b-41d4-a716-446655440000'
      ]

      validUUIDs.forEach(uuid => {
        const result = sanitizationSchemas.uuid.parse(uuid)
        expect(result).toBe(uuid)
      })
    })

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        '123',
        'not-a-uuid',
        '123e4567-e89b-12d3-a456-42661417400g'
      ]

      invalidUUIDs.forEach(uuid => {
        expect(() => sanitizationSchemas.uuid.parse(uuid)).toThrow()
      })
    })
  })

  describe('naicsCodeSchema', () => {
    it('should validate correct NAICS codes', () => {
      const validCodes = ['339112', '423450', '541511']

      validCodes.forEach(code => {
        const result = sanitizationSchemas.naicsCode.parse(code)
        expect(result).toBe(code)
      })
    })

    it('should reject invalid NAICS codes', () => {
      const invalidCodes = [
        '1',       // Too short (less than 2 digits)
        '1234567', // Too long (more than 6 digits)
        'abcdef',  // Not numeric
        "339112'; DROP TABLE--"
      ]

      invalidCodes.forEach(code => {
        expect(() => sanitizationSchemas.naicsCode.parse(code)).toThrow()
      })
    })
  })

  describe('dateSchema', () => {
    it('should parse valid date strings', () => {
      const validDates = [
        '2024-01-01',
        '2024-12-31',
        '2024-01-01T00:00:00Z',
        '2024-01-01T12:30:45.123Z'
      ]

      validDates.forEach(date => {
        const result = sanitizationSchemas.date.parse(date)
        expect(result).toBeInstanceOf(Date)
      })
    })

    it('should accept Date objects', () => {
      const date = new Date('2024-01-01')
      const result = sanitizationSchemas.date.parse(date)
      expect(result).toEqual(date)
    })

    it('should reject invalid dates', () => {
      const invalidDates = [
        'not-a-date',
        '2024-13-01', // Invalid month
        '2024-01-32', // Invalid day
        "2024-01-01'; DROP TABLE--"
      ]

      invalidDates.forEach(date => {
        expect(() => sanitizationSchemas.date.parse(date)).toThrow()
      })
    })
  })

  describe('paginationSchema', () => {
    it('should validate correct pagination params', () => {
      const valid = [
        { page: 1, pageSize: 20 },
        { page: 5, pageSize: 50 },
        { page: 1, pageSize: 100 }
      ]

      valid.forEach(params => {
        const result = sanitizationSchemas.pagination.parse(params)
        expect(result).toEqual(params)
      })
    })

    it('should apply defaults', () => {
      const result = sanitizationSchemas.pagination.parse({})
      expect(result).toEqual({ page: 1, pageSize: 20 })
    })

    it('should reject invalid pagination', () => {
      const invalid = [
        { page: 0, pageSize: 20 }, // Page too low
        { page: 1, pageSize: 0 }, // PageSize too low
        { page: 1, pageSize: 101 }, // PageSize too high
        { page: -1, pageSize: 20 }, // Negative page
      ]

      invalid.forEach(params => {
        expect(() => sanitizationSchemas.pagination.parse(params)).toThrow()
      })
    })
  })

  describe('opportunitySearchSchema', () => {
    it('should validate complete search params', () => {
      const params = {
        query: 'medical equipment',
        agencies: ['VA', 'DOD'],
        naicsCodes: ['339112', '339113'],
        setAsides: ['WOSB', 'SBA'],
        postedAfter: '2024-01-01',
        deadlineBefore: '2024-02-01',
        minValue: 100000,
        maxValue: 500000,
        includeExpired: false,
        onlyMedical: true,
        page: 1,
        pageSize: 25
      }

      const result = sanitizationSchemas.opportunitySearch.parse(params)
      expect(result.query).toBe('medical equipment')
      expect(result.postedAfter).toBeInstanceOf(Date)
      expect(result.deadlineBefore).toBeInstanceOf(Date)
    })

    it('should handle partial params with defaults', () => {
      const params = { query: 'test' }
      const result = sanitizationSchemas.opportunitySearch.parse(params)
      
      expect(result).toEqual({
        query: 'test',
        agencies: [],
        naicsCodes: [],
        setAsides: [],
        includeExpired: false,
        onlyMedical: false,
        page: 1,
        pageSize: 20
      })
    })

    it('should sanitize and validate all string inputs', () => {
      const params = {
        query: '  medical supplies  ',
        agencies: ['VA ', ' DOD']
      }

      const result = sanitizationSchemas.opportunitySearch.parse(params)
      expect(result.query).toBe('medical supplies')
      expect(result.agencies).toEqual(['VA', 'DOD'])
    })

  })
})

describe('sanitizeError', () => {
  it('should sanitize error messages', () => {
    const error = new Error("Database error: user 'test@example.com' not found")
    const sanitized = QuerySanitizer.sanitizeError(error)
    
    expect(sanitized.message).toBe("Database error: user '[EMAIL]' not found")
    expect(sanitized.originalMessage).toBeUndefined()
  })

  it('should preserve safe error messages', () => {
    const error = new Error('Validation failed: Invalid email format')
    const sanitized = QuerySanitizer.sanitizeError(error)
    
    expect(sanitized.message).toBe('Validation failed: Invalid email format')
  })

  it('should handle errors with stack traces', () => {
    const error = new Error('Test error')
    error.stack = 'Error: Test error\n    at /app/lib/db/query.ts:45:10'
    
    const sanitized = QuerySanitizer.sanitizeError(error)
    expect(sanitized.stack).toBeUndefined()
  })

  it('should handle non-Error objects', () => {
    const errorLike = { message: 'Something went wrong', code: 'ERR_001' }
    const sanitized = QuerySanitizer.sanitizeError(errorLike as any)
    
    expect(sanitized.message).toBe('An error occurred')
  })
})

describe('Performance', () => {
  it('should handle large input arrays efficiently', () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => `item-${i}`)
    
    const start = Date.now()
    const result = QuerySanitizer.sanitizeArray(largeArray)
    const duration = Date.now() - start
    
    expect(result).toHaveLength(1000)
    expect(duration).toBeLessThan(100) // Should complete within 100ms
  })

  it('should handle deeply nested objects', () => {
    const deepObject = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                value: 'deep value'
              }
            }
          }
        }
      }
    }
    
    const result = QuerySanitizer.sanitizeObject(deepObject)
    expect(result).toEqual(deepObject)
  })
})
})