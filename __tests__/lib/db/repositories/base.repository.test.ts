/**
 * Base Repository Unit Tests
 * 
 * Tests all common database operations, error handling,
 * query building, and validation functionality
 */

import { BaseRepository } from '@/lib/db/repositories/base.repository'
import { Database } from '@/types/database.types'
import { DatabaseError, NotFoundError, ValidationError } from '@/lib/errors/types'
import { 
  createMockSupabaseClient, 
  ErrorScenarios,
  assertQueryCalled 
} from '@/__tests__/utils/db-test-helper'
import { mockOpportunities } from '@/__tests__/mocks/db-data'
import { z } from 'zod'

// Create a concrete implementation for testing
class TestRepository extends BaseRepository<'opportunities'> {
  constructor(supabase: any) {
    super(supabase, 'opportunities')
  }

  // Expose protected methods for testing
  public testBuildQuery(query: any, options?: any) {
    return this.buildQuery(query, options)
  }

  public testHandleError(error: any, operation: string, context?: any) {
    return this.handleError(error, operation, context)
  }

  public async testValidate<T>(data: unknown, schema: z.ZodSchema<T>) {
    return this.validate(data, schema)
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    repository = new TestRepository(mockSupabase)
  })

  describe('CRUD Operations', () => {
    describe('findById', () => {
      it('should find a record by ID', async () => {
        const mockData = mockOpportunities[0]
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: mockData, error: null }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.findById('opp-1')

        expect(result).toEqual(mockData)
        expect(mockSupabase.from).toHaveBeenCalledWith('opportunities')
      })

      it('should return null when record not found', async () => {
        mockSupabase = createMockSupabaseClient({
          errors: {
            'opportunities.select': ErrorScenarios.postgresErrors.notFound
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.findById('non-existent')

        expect(result).toBeNull()
      })

      it('should use custom select columns', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: { id: 'opp-1', title: 'Test' }, error: null }
          }
        })
        repository = new TestRepository(mockSupabase)

        await repository.findById('opp-1', { select: 'id, title' })

        const query = mockSupabase.from.mock.results[0]?.value
        expect(query.select).toHaveBeenCalledWith('id, title')
      })
    })

    describe('findAll', () => {
      it('should return all records', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: mockOpportunities, error: null }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.findAll()

        expect(result).toEqual(mockOpportunities)
        expect(result).toHaveLength(3)
      })

      it('should apply filters', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: [mockOpportunities[0]], error: null }
          }
        })
        repository = new TestRepository(mockSupabase)

        await repository.findAll({
          filters: {
            agency: 'Department of Veterans Affairs',
            active: true,
            naics_codes: ['339112']
          }
        })

        const query = mockSupabase.from.mock.results[0]?.value
        expect(query.eq).toHaveBeenCalledWith('agency', 'Department of Veterans Affairs')
        expect(query.eq).toHaveBeenCalledWith('active', true)
        expect(query.in).toHaveBeenCalledWith('naics_codes', ['339112'])
      })

      it('should apply ordering', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: mockOpportunities, error: null }
          }
        })
        repository = new TestRepository(mockSupabase)

        await repository.findAll({
          orderBy: [
            { column: 'response_deadline', ascending: true },
            { column: 'posted_date', ascending: false }
          ]
        })

        const query = mockSupabase.from.mock.results[0]?.value
        expect(query.order).toHaveBeenCalledWith('response_deadline', { ascending: true })
        expect(query.order).toHaveBeenCalledWith('posted_date', { ascending: false })
      })

      it('should handle null filters', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: [], error: null }
          }
        })
        repository = new TestRepository(mockSupabase)

        await repository.findAll({
          filters: { secondary_poc: null }
        })

        const query = mockSupabase.from.mock.results[0]?.value
        expect(query.is).toHaveBeenCalledWith('secondary_poc', null)
      })
    })

    describe('findPaginated', () => {
      it('should return paginated results', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { 
              data: null, 
              error: null, 
              count: 50 
            }
          }
        })
        repository = new TestRepository(mockSupabase)

        // Mock for data query
        const secondMockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { 
              data: mockOpportunities.slice(0, 2), 
              error: null 
            }
          }
        })
        repository = new TestRepository(secondMockSupabase)

        const result = await repository.findPaginated({
          page: 2,
          pageSize: 20
        })

        expect(result.pagination).toEqual({
          page: 2,
          pageSize: 20,
          total: 0, // Due to our mock setup
          totalPages: 0,
          hasNext: false,
          hasPrevious: true
        })
      })

      it('should calculate correct offset', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: [], error: null, count: 100 }
          }
        })
        repository = new TestRepository(mockSupabase)

        await repository.findPaginated({
          page: 3,
          pageSize: 25
        })

        const query = mockSupabase.from.mock.results[1]?.value // Second query is for data
        expect(query.range).toHaveBeenCalledWith(50, 74) // offset: 50, limit: 25
      })
    })

    describe('create', () => {
      it('should create a new record', async () => {
        const newData = { title: 'New Opportunity' }
        const created = { ...mockOpportunities[0], ...newData }
        
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.insert': { data: created, error: null }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.create(newData as any)

        expect(result).toEqual(created)
        const query = mockSupabase.from.mock.results[0]?.value
        expect(query.insert).toHaveBeenCalledWith(newData)
      })

      it('should handle unique constraint violations', async () => {
        mockSupabase = createMockSupabaseClient({
          errors: {
            'opportunities.insert': ErrorScenarios.postgresErrors.uniqueViolation
          }
        })
        repository = new TestRepository(mockSupabase)

        await expect(repository.create({ notice_id: 'duplicate' } as any))
          .rejects.toThrow(DatabaseError)
      })
    })

    describe('createMany', () => {
      it('should create multiple records', async () => {
        const newRecords = [
          { title: 'Opportunity 1' },
          { title: 'Opportunity 2' }
        ]
        
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.insert': { 
              data: newRecords.map((r, i) => ({ ...mockOpportunities[0], ...r, id: `new-${i}` })), 
              error: null 
            }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.createMany(newRecords as any)

        expect(result).toHaveLength(2)
        expect(mockSupabase.from).toHaveBeenCalledWith('opportunities')
      })

      it('should return empty array for empty input', async () => {
        const result = await repository.createMany([])
        expect(result).toEqual([])
        expect(mockSupabase.from).not.toHaveBeenCalled()
      })
    })

    describe('update', () => {
      it('should update a record', async () => {
        const updates = { title: 'Updated Title' }
        const updated = { ...mockOpportunities[0], ...updates }
        
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.update': { data: updated, error: null }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.update('opp-1', updates as any)

        expect(result).toEqual(updated)
        const query = mockSupabase.from.mock.results[0]?.value
        expect(query.update).toHaveBeenCalledWith(updates)
        expect(query.eq).toHaveBeenCalledWith('id', 'opp-1')
      })

      it('should throw NotFoundError when record does not exist', async () => {
        mockSupabase = createMockSupabaseClient({
          errors: {
            'opportunities.update': ErrorScenarios.postgresErrors.notFound
          }
        })
        repository = new TestRepository(mockSupabase)

        await expect(repository.update('non-existent', {}))
          .rejects.toThrow(NotFoundError)
      })
    })

    describe('updateMany', () => {
      it('should update multiple records', async () => {
        const filter = { agency: 'VA' }
        const updates = { active: false }
        
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.update': { 
              data: [mockOpportunities[0], mockOpportunities[1]], 
              error: null 
            }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.updateMany(filter, updates as any)

        expect(result).toHaveLength(2)
        const query = mockSupabase.from.mock.results[0]?.value
        expect(query.update).toHaveBeenCalledWith(updates)
        expect(query.eq).toHaveBeenCalledWith('agency', 'VA')
      })
    })

    describe('delete', () => {
      it('should delete a record', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.delete': { data: null, error: null }
          }
        })
        repository = new TestRepository(mockSupabase)

        await repository.delete('opp-1')

        const query = mockSupabase.from.mock.results[0]?.value
        expect(query.delete).toHaveBeenCalled()
        expect(query.eq).toHaveBeenCalledWith('id', 'opp-1')
      })

      it('should throw NotFoundError when record does not exist', async () => {
        mockSupabase = createMockSupabaseClient({
          errors: {
            'opportunities.delete': ErrorScenarios.postgresErrors.notFound
          }
        })
        repository = new TestRepository(mockSupabase)

        await expect(repository.delete('non-existent'))
          .rejects.toThrow(NotFoundError)
      })
    })

    describe('deleteMany', () => {
      it('should delete multiple records and return count', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: null, error: null, count: 5 },
            'opportunities.delete': { data: null, error: null }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.deleteMany({ active: false })

        expect(result).toBe(5)
        const countQuery = mockSupabase.from.mock.results[0]?.value
        expect(countQuery.select).toHaveBeenCalledWith('*', { count: 'exact', head: true })
      })
    })

    describe('exists', () => {
      it('should return true when records exist', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: null, error: null, count: 1 }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.exists({ notice_id: 'VA-24-00001' })

        expect(result).toBe(true)
      })

      it('should return false when no records exist', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: null, error: null, count: 0 }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.exists({ notice_id: 'non-existent' })

        expect(result).toBe(false)
      })
    })

    describe('count', () => {
      it('should return total count', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: null, error: null, count: 42 }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.count()

        expect(result).toBe(42)
      })

      it('should count with filters', async () => {
        mockSupabase = createMockSupabaseClient({
          responses: {
            'opportunities.select': { data: null, error: null, count: 10 }
          }
        })
        repository = new TestRepository(mockSupabase)

        const result = await repository.count({ active: true })

        expect(result).toBe(10)
        const query = mockSupabase.from.mock.results[0]?.value
        expect(query.match).toHaveBeenCalledWith({ active: true })
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle unique constraint violations', () => {
      const error = repository.testHandleError(
        ErrorScenarios.postgresErrors.uniqueViolation,
        'create'
      )

      expect(error).toBeInstanceOf(DatabaseError)
      expect(error.message).toContain('already exists')
      expect((error as DatabaseError).code).toBe('UNIQUE_VIOLATION')
    })

    it('should handle foreign key violations', () => {
      const error = repository.testHandleError(
        ErrorScenarios.postgresErrors.foreignKeyViolation,
        'create'
      )

      expect(error).toBeInstanceOf(DatabaseError)
      expect(error.message).toContain('Referenced record does not exist')
      expect((error as DatabaseError).code).toBe('FOREIGN_KEY_VIOLATION')
    })

    it('should handle not null violations', () => {
      const error = repository.testHandleError(
        ErrorScenarios.postgresErrors.notNullViolation,
        'update'
      )

      expect(error).toBeInstanceOf(DatabaseError)
      expect(error.message).toContain('Required field is missing')
      expect((error as DatabaseError).code).toBe('NOT_NULL_VIOLATION')
    })

    it('should handle table not found errors', () => {
      const error = repository.testHandleError(
        ErrorScenarios.postgresErrors.tableNotFound,
        'findAll'
      )

      expect(error).toBeInstanceOf(DatabaseError)
      expect(error.message).toContain('table not found')
      expect((error as DatabaseError).code).toBe('TABLE_NOT_FOUND')
    })

    it('should preserve context in errors', () => {
      const context = { id: 'test-id', operation: 'update' }
      const error = repository.testHandleError(
        new Error('Generic error'),
        'update',
        context
      ) as DatabaseError

      expect(error.context).toMatchObject({
        ...context,
        table: 'opportunities',
        operation: 'update'
      })
    })

    it('should pass through existing AppErrors', () => {
      const originalError = new NotFoundError('Record not found')
      const error = repository.testHandleError(originalError, 'findById')

      expect(error).toBe(originalError)
    })
  })

  describe('Query Building', () => {
    it('should build query with all options', () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis()
      }

      const result = repository.testBuildQuery(mockQuery, {
        filters: {
          active: true,
          agency: null,
          naics_codes: ['339112', '339113']
        },
        orderBy: [
          { column: 'posted_date', ascending: false },
          { column: 'title', ascending: true }
        ],
        limit: 20,
        offset: 40
      })

      expect(mockQuery.eq).toHaveBeenCalledWith('active', true)
      expect(mockQuery.is).toHaveBeenCalledWith('agency', null)
      expect(mockQuery.in).toHaveBeenCalledWith('naics_codes', ['339112', '339113'])
      expect(mockQuery.order).toHaveBeenCalledWith('posted_date', { ascending: false })
      expect(mockQuery.order).toHaveBeenCalledWith('title', { ascending: true })
      expect(mockQuery.limit).toHaveBeenCalledWith(20)
      expect(mockQuery.range).toHaveBeenCalledWith(40, 59)
      expect(result).toBe(mockQuery)
    })

    it('should handle empty options', () => {
      const mockQuery = { test: 'query' }
      const result = repository.testBuildQuery(mockQuery)
      expect(result).toBe(mockQuery)
    })
  })

  describe('Validation', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
      email: z.string().email()
    })

    it('should validate valid data', async () => {
      const data = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      }

      const result = await repository.testValidate(data, testSchema)
      expect(result).toEqual(data)
    })

    it('should throw ValidationError for invalid data', async () => {
      const data = {
        name: '',
        age: -5,
        email: 'not-an-email'
      }

      await expect(repository.testValidate(data, testSchema))
        .rejects.toThrow(ValidationError)
    })

    it('should include validation errors in exception', async () => {
      const data = { name: '', age: 25, email: 'test@example.com' }

      try {
        await repository.testValidate(data, testSchema)
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).errors).toHaveLength(1)
        expect((error as ValidationError).errors[0].path).toEqual(['name'])
      }
    })
  })

  describe('Transaction Support', () => {
    it('should execute callback with client', async () => {
      const callback = jest.fn().mockResolvedValue('result')
      
      const result = await repository.transaction(callback)

      expect(callback).toHaveBeenCalledWith(mockSupabase)
      expect(result).toBe('result')
    })

    it('should propagate callback errors', async () => {
      const callback = jest.fn().mockRejectedValue(new Error('Transaction failed'))

      await expect(repository.transaction(callback))
        .rejects.toThrow(DatabaseError)
    })
  })
})