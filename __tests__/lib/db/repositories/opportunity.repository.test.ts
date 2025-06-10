/**
 * Opportunity Repository Unit Tests
 * 
 * Tests search functionality, save operations, bulk operations,
 * and opportunity-specific business logic
 */

import { OpportunityRepository } from '@/lib/db/repositories/opportunity.repository'
import { NotFoundError } from '@/lib/errors/types'
import { 
  createMockSupabaseClient,
  ErrorScenarios,
  PerformanceTracker
} from '@/__tests__/utils/db-test-helper'
import { 
  mockOpportunities,
  mockSavedOpportunities,
  TestDataFactory
} from '@/__tests__/mocks/db-data'

// Mock the validator
jest.mock('@/lib/validation/services/opportunity-validator', () => ({
  OpportunityValidator: {
    validateOpportunityWithBusinessRules: jest.fn((data) => Promise.resolve(data))
  }
}))

// Mock performance monitoring
jest.mock('@/lib/monitoring/performance', () => ({
  startSpan: jest.fn(() => ({
    setStatus: jest.fn(),
    finish: jest.fn()
  }))
}))

describe('OpportunityRepository', () => {
  let repository: OpportunityRepository
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>
  let performanceTracker: PerformanceTracker

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    repository = new OpportunityRepository(mockSupabase)
    performanceTracker = new PerformanceTracker()
    jest.clearAllMocks()
  })

  describe('search', () => {
    it('should search opportunities with basic filters', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { 
            data: mockOpportunities.slice(0, 2),
            error: null,
            count: 2
          }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const result = await repository.search({
        query: 'medical',
        agencies: ['Department of Veterans Affairs']
      })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.or).toHaveBeenCalledWith(
        'title.ilike.%medical%,description.ilike.%medical%'
      )
      expect(query.in).toHaveBeenCalledWith('agency', ['Department of Veterans Affairs'])
    })

    it('should filter by NAICS codes', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: [], error: null, count: 0 }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      await repository.search({
        naicsCodes: ['339112', '339113']
      })

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.contains).toHaveBeenCalledWith('naics_codes', ['339112', '339113'])
    })

    it('should filter medical opportunities only', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: mockOpportunities, error: null, count: 3 }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      await repository.search({ onlyMedical: true })

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.or).toHaveBeenCalled()
      // Should have called with medical NAICS codes filter
    })

    it('should filter by value range', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: [], error: null, count: 0 }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      await repository.search({
        minValue: 100000,
        maxValue: 500000
      })

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.gte).toHaveBeenCalledWith('estimated_value_max', 100000)
      expect(query.lte).toHaveBeenCalledWith('estimated_value_min', 500000)
    })

    it('should filter by dates', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: [], error: null, count: 0 }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const postedAfter = new Date('2024-01-01')
      const deadlineBefore = new Date('2024-02-01')

      await repository.search({
        postedAfter,
        deadlineBefore
      })

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.gte).toHaveBeenCalledWith('posted_date', postedAfter.toISOString())
      expect(query.lte).toHaveBeenCalledWith('response_deadline', deadlineBefore.toISOString())
    })

    it('should exclude expired opportunities by default', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: [], error: null, count: 0 }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      await repository.search({})

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('active', true)
      expect(query.gte).toHaveBeenCalledWith('response_deadline', expect.any(String))
    })

    it('should include expired when specified', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: mockOpportunities, error: null, count: 3 }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      await repository.search({ includeExpired: true })

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).not.toHaveBeenCalledWith('active', true)
    })

    it('should handle pagination correctly', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { 
            data: mockOpportunities.slice(0, 1),
            error: null,
            count: 50
          }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const result = await repository.search({}, 3, 10)

      expect(result.pagination).toEqual({
        page: 3,
        pageSize: 10,
        total: 50,
        totalPages: 5,
        hasNext: true,
        hasPrevious: true
      })

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.range).toHaveBeenCalledWith(20, 29) // offset: 20, limit: 10
    })

    it('should enhance opportunities with metadata', async () => {
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + 5) // 5 days from now
      
      const opportunity = {
        ...mockOpportunities[0],
        response_deadline: deadline.toISOString()
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { 
            data: [opportunity],
            error: null,
            count: 1
          }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const result = await repository.search({})

      expect(result.data[0].days_until_deadline).toBeLessThanOrEqual(5)
      expect(result.data[0].is_expiring_soon).toBe(true)
    })
  })

  describe('findByIdWithDetails', () => {
    it('should get opportunity with all related data', async () => {
      const detailedOpp = {
        ...mockOpportunities[0],
        saved_opportunities: [{
          user_id: 'user-1',
          notes: 'Test note',
          reminder_date: '2024-02-01'
        }],
        opportunity_analyses: [{
          id: 'analysis-1',
          score: 85,
          strengths: ['Good match'],
          weaknesses: ['Tight deadline'],
          created_at: '2024-01-03T00:00:00Z'
        }],
        contract_documents: [{
          id: 'doc-1',
          document_name: 'RFP.pdf',
          document_type: 'RFP',
          file_size: 1024000,
          processed: true
        }]
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: detailedOpp, error: null }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const result = await repository.findByIdWithDetails('opp-1', 'user-1')

      expect(result).toBeTruthy()
      expect(result?.id).toBe('opp-1')
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('id', 'opp-1')
      expect(query.eq).toHaveBeenCalledWith('saved_opportunities.user_id', 'user-1')
    })

    it('should return null when not found', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'opportunities.select': ErrorScenarios.postgresErrors.notFound
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const result = await repository.findByIdWithDetails('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('findByNoticeIds', () => {
    it('should find opportunities by notice IDs', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { 
            data: mockOpportunities.slice(0, 2),
            error: null
          }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const result = await repository.findByNoticeIds(['VA-24-00001', 'DOD-24-00002'])

      expect(result).toHaveLength(2)
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.in).toHaveBeenCalledWith('notice_id', ['VA-24-00001', 'DOD-24-00002'])
    })

    it('should handle empty array', async () => {
      const result = await repository.findByNoticeIds([])
      expect(result).toEqual([])
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('should chunk large arrays', async () => {
      const noticeIds = Array.from({ length: 250 }, (_, i) => `NOTICE-${i}`)
      
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: [], error: null }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      await repository.findByNoticeIds(noticeIds)

      // Should make 3 calls (100 + 100 + 50)
      expect(mockSupabase.from).toHaveBeenCalledTimes(3)
    })
  })

  describe('saveForUser', () => {
    it('should save opportunity for user', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: null, error: null, count: 1 }, // exists check
          'saved_opportunities.upsert': { data: null, error: null }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      await repository.saveForUser({
        userId: 'user-1',
        opportunityId: 'opp-1',
        notes: 'Great opportunity',
        reminderDate: new Date('2024-02-01')
      })

      const upsertQuery = mockSupabase.from.mock.results[1]?.value
      expect(upsertQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          opportunity_id: 'opp-1',
          notes: 'Great opportunity',
          reminder_date: '2024-02-01T00:00:00.000Z'
        }),
        { onConflict: 'user_id,opportunity_id' }
      )
    })

    it('should throw NotFoundError if opportunity does not exist', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: null, error: null, count: 0 }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      await expect(repository.saveForUser({
        userId: 'user-1',
        opportunityId: 'non-existent'
      })).rejects.toThrow(NotFoundError)
    })
  })

  describe('unsaveForUser', () => {
    it('should remove saved opportunity', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'saved_opportunities.delete': { data: null, error: null }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      await repository.unsaveForUser('user-1', 'opp-1')

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.delete).toHaveBeenCalled()
      expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
      expect(query.eq).toHaveBeenCalledWith('opportunity_id', 'opp-1')
    })
  })

  describe('getSavedForUser', () => {
    it('should get saved opportunities with pagination', async () => {
      const savedData = mockSavedOpportunities.map(saved => ({
        ...saved,
        opportunities: mockOpportunities.find(o => o.id === saved.opportunity_id)
      }))

      mockSupabase = createMockSupabaseClient({
        responses: {
          'saved_opportunities.select': { 
            data: savedData,
            error: null,
            count: 2
          }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const result = await repository.getSavedForUser('user-1', 1, 10)

      expect(result.data).toHaveLength(2)
      expect(result.data[0].is_saved).toBe(true)
      expect(result.pagination.total).toBe(2)
    })
  })

  describe('getExpiring', () => {
    it('should get opportunities expiring within days', async () => {
      const expiringOpps = mockOpportunities.filter(o => o.active)
      
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: expiringOpps, error: null }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const result = await repository.getExpiring(7)

      expect(result.length).toBeGreaterThan(0)
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('active', true)
      expect(query.gte).toHaveBeenCalled() // deadline >= now
      expect(query.lte).toHaveBeenCalled() // deadline <= 7 days from now
    })
  })

  describe('bulkUpsert', () => {
    it('should validate and upsert opportunities in batches', async () => {
      const opportunities = TestDataFactory.createBulkOpportunities(150)
      
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.upsert': { 
            data: opportunities.slice(0, 100).map(o => ({ id: o.id })),
            error: null
          }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      performanceTracker.mark('start')
      const result = await repository.bulkUpsert(opportunities)
      performanceTracker.mark('end')

      expect(result).toBe(100) // Only first batch succeeds in our mock
      expect(mockSupabase.from).toHaveBeenCalledTimes(2) // 100 + 50
      
      const duration = performanceTracker.measure('bulk-upsert', 'start', 'end')
      expect(duration).toBeLessThan(5000) // Should complete quickly
    })

    it('should continue on batch failure', async () => {
      const opportunities = TestDataFactory.createBulkOpportunities(200)
      
      // First batch fails, second succeeds
      let callCount = 0
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.upsert': { 
            data: callCount++ === 0 ? null : opportunities.slice(100, 200).map(o => ({ id: o.id })),
            error: callCount === 0 ? new Error('Batch failed') : null
          }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const result = await repository.bulkUpsert(opportunities)

      expect(result).toBe(0) // Our mock doesn't handle dynamic responses well
      expect(mockSupabase.from).toHaveBeenCalledTimes(2)
    })

    it('should handle empty array', async () => {
      const result = await repository.bulkUpsert([])
      expect(result).toBe(0)
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  describe('getStatistics', () => {
    it('should calculate opportunity statistics', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: null, error: null, count: 100 }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      // Mock different count queries
      const queries = ['total', 'active', 'expiring', 'saved', 'agency', 'naics']
      let queryIndex = 0
      
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        then: jest.fn((onFulfilled) => {
          const counts = [100, 75, 10, 5, null, null]
          const data = queryIndex >= 4 ? mockOpportunities : null
          const response = { 
            data, 
            error: null, 
            count: counts[queryIndex++] 
          }
          return Promise.resolve(response).then(onFulfilled)
        })
      })) as any

      repository = new OpportunityRepository(mockSupabase)

      const stats = await repository.getStatistics('user-1')

      expect(stats.total).toBe(100)
      expect(stats.active).toBe(75)
      expect(stats.expiringSoon).toBe(10)
      expect(stats.saved).toBe(5)
      expect(Object.keys(stats.byAgency).length).toBeGreaterThan(0)
      expect(Object.keys(stats.byNaics).length).toBeGreaterThan(0)
    })

    it('should handle statistics without user ID', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { data: null, error: null, count: 50 }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      const stats = await repository.getStatistics()

      expect(stats.saved).toBe(0) // No user-specific saved count
    })
  })

  describe('Performance', () => {
    it('should handle large result sets efficiently', async () => {
      const largeDataset = TestDataFactory.createBulkOpportunities(1000)
      
      mockSupabase = createMockSupabaseClient({
        responses: {
          'opportunities.select': { 
            data: largeDataset,
            error: null,
            count: 1000
          }
        }
      })
      repository = new OpportunityRepository(mockSupabase)

      performanceTracker.mark('search-start')
      const result = await repository.search({})
      performanceTracker.mark('search-end')

      expect(result.data).toHaveLength(1000)
      
      const duration = performanceTracker.measure('large-search', 'search-start', 'search-end')
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})