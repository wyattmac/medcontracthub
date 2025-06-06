/**
 * Service Layer Test: SAM.gov Utilities
 * Tests the utility functions for SAM.gov data processing
 */

import {
  calculateOpportunityMatch,
  getOpportunitiesFromDatabase,
  buildSearchFilters,
  normalizeNAICSCode
} from '@/lib/sam-gov/utils'
import { createMockOpportunity } from '../../utils/api-test-helper'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    then: jest.fn()
  })
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase)
}))

describe('SAM.gov Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateOpportunityMatch', () => {
    const testOpportunity = createMockOpportunity({
      naics_code: '339112',
      title: 'Medical Diagnostic Equipment Procurement',
      description: 'Procurement of advanced medical diagnostic equipment including MRI and CT scanners'
    })

    it('should return 100% match for exact NAICS code match', () => {
      const companyNAICS = ['339112', '334510']
      const matchScore = calculateOpportunityMatch(testOpportunity, companyNAICS)
      
      expect(matchScore).toBe(100)
    })

    it('should return 80% match for same category (first 4 digits)', () => {
      const companyNAICS = ['339113', '334510'] // Same category (3391) but different subcategory
      const matchScore = calculateOpportunityMatch(testOpportunity, companyNAICS)
      
      expect(matchScore).toBe(80)
    })

    it('should return 60% match for same sector (first 2 digits)', () => {
      const companyNAICS = ['339900', '334510'] // Same sector (33) but different subsector
      const matchScore = calculateOpportunityMatch(testOpportunity, companyNAICS)
      
      expect(matchScore).toBe(60)
    })

    it('should return 0% match for no NAICS overlap', () => {
      const companyNAICS = ['541511', '111110'] // Completely different sectors
      const matchScore = calculateOpportunityMatch(testOpportunity, companyNAICS)
      
      expect(matchScore).toBe(0)
    })

    it('should handle multiple NAICS codes and return highest match', () => {
      const companyNAICS = ['541511', '339112', '111110'] // One exact match among others
      const matchScore = calculateOpportunityMatch(testOpportunity, companyNAICS)
      
      expect(matchScore).toBe(100)
    })

    it('should handle missing NAICS code gracefully', () => {
      const opportunityWithoutNAICS = createMockOpportunity({
        naics_code: null,
        title: 'General Procurement'
      })
      const companyNAICS = ['339112']
      const matchScore = calculateOpportunityMatch(opportunityWithoutNAICS, companyNAICS)
      
      expect(matchScore).toBe(0)
    })

    it('should handle empty company NAICS codes', () => {
      const companyNAICS: string[] = []
      const matchScore = calculateOpportunityMatch(testOpportunity, companyNAICS)
      
      expect(matchScore).toBe(0)
    })

    it('should normalize NAICS codes before comparison', () => {
      const testOpp = createMockOpportunity({
        naics_code: '339112000' // With trailing zeros
      })
      const companyNAICS = ['339112'] // Without trailing zeros
      const matchScore = calculateOpportunityMatch(testOpp, companyNAICS)
      
      expect(matchScore).toBe(100)
    })
  })

  describe('normalizeNAICSCode', () => {
    it('should remove trailing zeros', () => {
      expect(normalizeNAICSCode('339112000')).toBe('339112')
      expect(normalizeNAICSCode('541511100')).toBe('5415111')
    })

    it('should handle codes without trailing zeros', () => {
      expect(normalizeNAICSCode('339112')).toBe('339112')
      expect(normalizeNAICSCode('54151')).toBe('54151')
    })

    it('should handle null/undefined codes', () => {
      expect(normalizeNAICSCode(null)).toBeNull()
      expect(normalizeNAICSCode(undefined)).toBeNull()
      expect(normalizeNAICSCode('')).toBeNull()
    })

    it('should handle non-string inputs', () => {
      expect(normalizeNAICSCode(339112 as any)).toBe('339112')
    })
  })

  describe('buildSearchFilters', () => {
    it('should build basic search filters correctly', () => {
      const filters = {
        searchQuery: 'medical equipment',
        naicsCodes: ['339112', '334510'],
        state: 'CA',
        status: 'active' as const,
        limit: 25,
        offset: 0
      }

      const result = buildSearchFilters(filters)

      expect(result).toEqual({
        textSearch: 'medical equipment',
        naicsFilter: ['339112', '334510'],
        stateFilter: 'CA',
        statusFilter: 'active',
        pagination: { limit: 25, offset: 0 }
      })
    })

    it('should handle missing optional filters', () => {
      const filters = {
        limit: 10,
        offset: 0
      }

      const result = buildSearchFilters(filters)

      expect(result).toEqual({
        textSearch: undefined,
        naicsFilter: undefined,
        stateFilter: undefined,
        statusFilter: undefined,
        pagination: { limit: 10, offset: 0 }
      })
    })

    it('should handle date range filters', () => {
      const filters = {
        responseDeadlineFrom: '2024-01-01T00:00:00Z',
        responseDeadlineTo: '2024-12-31T23:59:59Z',
        limit: 25,
        offset: 0
      }

      const result = buildSearchFilters(filters)

      expect(result).toHaveProperty('dateFilter')
      expect(result.dateFilter).toEqual({
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z'
      })
    })

    it('should sanitize and validate inputs', () => {
      const filters = {
        searchQuery: '<script>alert("xss")</script>medical',
        naicsCodes: ['339112', 'invalid-naics', '334510'],
        state: 'INVALID_STATE',
        limit: 1000, // Over limit
        offset: -5 // Invalid
      }

      const result = buildSearchFilters(filters)

      expect(result.textSearch).not.toContain('<script>')
      expect(result.naicsFilter).toEqual(['339112', '334510']) // Invalid NAICS removed
      expect(result.stateFilter).toBeUndefined() // Invalid state removed
      expect(result.pagination.limit).toBeLessThanOrEqual(100) // Clamped to max
      expect(result.pagination.offset).toBeGreaterThanOrEqual(0) // Clamped to min
    })
  })

  describe('getOpportunitiesFromDatabase', () => {
    const mockOpportunities = [
      createMockOpportunity({
        id: 'opp-1',
        title: 'Medical Equipment',
        naics_code: '339112'
      }),
      createMockOpportunity({
        id: 'opp-2',
        title: 'Surgical Instruments',
        naics_code: '339112'
      })
    ]

    beforeEach(() => {
      // Reset the mock chain
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: mockOpportunities,
          count: mockOpportunities.length,
          error: null
        })
      })
    })

    it('should fetch opportunities with basic filters', async () => {
      const filters = {
        limit: 25,
        offset: 0
      }

      const result = await getOpportunitiesFromDatabase(filters)

      expect(mockSupabase.from).toHaveBeenCalledWith('opportunities')
      expect(result).toEqual({
        data: mockOpportunities,
        count: mockOpportunities.length,
        error: null
      })
    })

    it('should apply text search filter', async () => {
      const filters = {
        searchQuery: 'medical',
        limit: 25,
        offset: 0
      }

      await getOpportunitiesFromDatabase(filters)

      const mockQuery = mockSupabase.from().select()
      expect(mockQuery.ilike).toHaveBeenCalledWith('title', '%medical%')
    })

    it('should apply NAICS code filter', async () => {
      const filters = {
        naicsCodes: ['339112', '334510'],
        limit: 25,
        offset: 0
      }

      await getOpportunitiesFromDatabase(filters)

      const mockQuery = mockSupabase.from().select()
      expect(mockQuery.in).toHaveBeenCalledWith('naics_code', ['339112', '334510'])
    })

    it('should apply state filter', async () => {
      const filters = {
        state: 'CA',
        limit: 25,
        offset: 0
      }

      await getOpportunitiesFromDatabase(filters)

      const mockQuery = mockSupabase.from().select()
      expect(mockQuery.eq).toHaveBeenCalledWith('place_of_performance_state', 'CA')
    })

    it('should apply date range filters', async () => {
      const filters = {
        responseDeadlineFrom: '2024-01-01T00:00:00Z',
        responseDeadlineTo: '2024-12-31T23:59:59Z',
        limit: 25,
        offset: 0
      }

      await getOpportunitiesFromDatabase(filters)

      const mockQuery = mockSupabase.from().select()
      expect(mockQuery.gte).toHaveBeenCalledWith('response_deadline', '2024-01-01T00:00:00Z')
      expect(mockQuery.lte).toHaveBeenCalledWith('response_deadline', '2024-12-31T23:59:59Z')
    })

    it('should apply pagination', async () => {
      const filters = {
        limit: 50,
        offset: 100
      }

      await getOpportunitiesFromDatabase(filters)

      const mockQuery = mockSupabase.from().select()
      expect(mockQuery.range).toHaveBeenCalledWith(100, 149) // offset to (offset + limit - 1)
    })

    it('should order results by relevance and deadline', async () => {
      const filters = {
        companyNaicsCodes: ['339112'],
        limit: 25,
        offset: 0
      }

      await getOpportunitiesFromDatabase(filters)

      const mockQuery = mockSupabase.from().select()
      expect(mockQuery.order).toHaveBeenCalledWith('response_deadline', { ascending: true })
    })

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed')
      
      mockSupabase.from().select().then.mockResolvedValue({
        data: null,
        count: 0,
        error: dbError
      })

      const result = await getOpportunitiesFromDatabase({ limit: 25, offset: 0 })

      expect(result).toEqual({
        data: null,
        count: 0,
        error: dbError
      })
    })

    it('should include saved status in join query', async () => {
      const filters = {
        userId: 'test-user-123',
        limit: 25,
        offset: 0
      }

      await getOpportunitiesFromDatabase(filters)

      const selectCall = mockSupabase.from().select
      expect(selectCall).toHaveBeenCalledWith(
        expect.stringContaining('saved_opportunities')
      )
    })

    it('should optimize query for company NAICS codes', async () => {
      const filters = {
        companyNaicsCodes: ['339112', '334510'],
        limit: 25,
        offset: 0
      }

      await getOpportunitiesFromDatabase(filters)

      // Should prioritize opportunities matching company NAICS
      const mockQuery = mockSupabase.from().select()
      expect(mockQuery.order).toHaveBeenCalled()
    })
  })
})