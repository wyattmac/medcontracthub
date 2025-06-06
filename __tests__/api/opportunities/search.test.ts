/**
 * API Route Test: /api/opportunities/search
 * Comprehensive testing for opportunity search functionality
 */

// We'll test the route handler directly
import { routeHandler } from '@/lib/api/route-handler'
import {
  setupApiTest,
  assertApiResponse,
  assertApiError,
  createMockOpportunity,
  createMockProfile,
  testAuthentication,
  testValidation
} from '../../utils/api-test-helper'

// Mock dependencies
jest.mock('@/lib/sam-gov/utils', () => ({
  getOpportunitiesFromDatabase: jest.fn(),
  calculateOpportunityMatch: jest.fn()
}))

jest.mock('@/lib/sam-gov/quota-manager', () => ({
  getSAMQuotaManager: jest.fn(() => ({
    getQuotaStatus: jest.fn().mockResolvedValue({
      daily: { remaining: 500, used: 100 }
    })
  }))
}))

jest.mock('@/lib/utils/cache', () => ({
  searchCache: {
    getWithStats: jest.fn(),
    set: jest.fn()
  },
  createCacheKey: jest.fn().mockReturnValue('test-cache-key')
}))

import { getOpportunitiesFromDatabase, calculateOpportunityMatch } from '@/lib/sam-gov/utils'
import { getSAMQuotaManager } from '@/lib/sam-gov/quota-manager'
import { searchCache } from '@/lib/utils/cache'

const mockGetOpportunities = getOpportunitiesFromDatabase as jest.MockedFunction<typeof getOpportunitiesFromDatabase>
const mockCalculateMatch = calculateOpportunityMatch as jest.MockedFunction<typeof calculateOpportunityMatch>
const mockSearchCache = searchCache as jest.Mocked<typeof searchCache>

describe('/api/opportunities/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    mockGetOpportunities.mockResolvedValue({
      data: [createMockOpportunity()],
      count: 1,
      error: null
    })
    
    mockCalculateMatch.mockReturnValue(85)
    mockSearchCache.getWithStats.mockReturnValue(null)
  })

  describe('Authentication', () => {
    it('should require authentication', async () => {
      await testAuthentication(GET, '/api/opportunities/search')
    })
  })

  describe('Query Validation', () => {
    it('should accept valid query parameters', async () => {
      const context = await setupApiTest('GET', '/api/opportunities/search?q=medical&limit=10&offset=0', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const response = await GET(context.request)
      
      await assertApiResponse(response, 200, {
        opportunities: expect.any(Array),
        totalCount: expect.any(Number),
        hasMore: expect.any(Boolean)
      })

      await context.cleanup()
    })

    it('should reject invalid limit values', async () => {
      await testValidation(
        GET,
        '/api/opportunities/search?limit=999',
        {},
        'GET'
      )
    })

    it('should reject invalid state codes', async () => {
      await testValidation(
        GET,
        '/api/opportunities/search?state=INVALID',
        {},
        'GET'
      )
    })

    it('should reject invalid status values', async () => {
      await testValidation(
        GET,
        '/api/opportunities/search?status=invalid',
        {},
        'GET'
      )
    })
  })

  describe('User Profile Integration', () => {
    it('should handle user without company profile', async () => {
      const context = await setupApiTest('GET', '/api/opportunities/search', {
        user: { id: 'test-user' },
        mockData: {
          profile: { id: 'test-user', company_id: null }
        }
      })

      const response = await GET(context.request)
      
      await assertApiError(response, 404, 'NOT_FOUND_ERROR')

      await context.cleanup()
    })

    it('should use company NAICS codes for filtering when none specified', async () => {
      const mockProfile = createMockProfile({
        companies: {
          naics_codes: ['339112', '334510']
        }
      })

      const context = await setupApiTest('GET', '/api/opportunities/search', {
        user: { id: 'test-user' },
        mockData: {
          profile: mockProfile
        }
      })

      await GET(context.request)
      
      // Verify that getOpportunitiesFromDatabase was called with company NAICS codes
      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          naicsCodes: ['339112', '334510'],
          companyNaicsCodes: ['339112', '334510']
        })
      )

      await context.cleanup()
    })

    it('should prioritize explicit NAICS filter over company NAICS', async () => {
      const context = await setupApiTest('GET', '/api/opportunities/search?naics=123456', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile({
            companies: {
              naics_codes: ['339112', '334510']
            }
          })
        }
      })

      await GET(context.request)
      
      // Verify explicit NAICS codes are used
      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          naicsCodes: ['123456']
        })
      )

      await context.cleanup()
    })
  })

  describe('Search Functionality', () => {
    it('should search with text query', async () => {
      const context = await setupApiTest('GET', '/api/opportunities/search?q=medical+equipment', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      await GET(context.request)
      
      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: 'medical equipment'
        })
      )

      await context.cleanup()
    })

    it('should filter by state', async () => {
      const context = await setupApiTest('GET', '/api/opportunities/search?state=CA', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      await GET(context.request)
      
      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CA'
        })
      )

      await context.cleanup()
    })

    it('should filter by status', async () => {
      const context = await setupApiTest('GET', '/api/opportunities/search?status=active', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      await GET(context.request)
      
      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active'
        })
      )

      await context.cleanup()
    })

    it('should handle pagination', async () => {
      const context = await setupApiTest('GET', '/api/opportunities/search?limit=5&offset=10', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      await GET(context.request)
      
      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 10
        })
      )

      await context.cleanup()
    })
  })

  describe('Match Scoring', () => {
    it('should calculate and include match scores', async () => {
      const mockOpportunity = createMockOpportunity()
      mockGetOpportunities.mockResolvedValue({
        data: [mockOpportunity],
        count: 1,
        error: null
      })
      mockCalculateMatch.mockReturnValue(92)

      const context = await setupApiTest('GET', '/api/opportunities/search', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const response = await GET(context.request)
      const data = await response.json()
      
      expect(data.opportunities[0]).toHaveProperty('matchScore', 92)
      expect(mockCalculateMatch).toHaveBeenCalledWith(
        mockOpportunity,
        ['339112', '334510']
      )

      await context.cleanup()
    })

    it('should sort opportunities by match score', async () => {
      const mockOpportunities = [
        createMockOpportunity({ id: 'opp1' }),
        createMockOpportunity({ id: 'opp2' }),
        createMockOpportunity({ id: 'opp3' })
      ]
      
      mockGetOpportunities.mockResolvedValue({
        data: mockOpportunities,
        count: 3,
        error: null
      })

      // Mock different match scores
      mockCalculateMatch
        .mockReturnValueOnce(75) // opp1
        .mockReturnValueOnce(95) // opp2
        .mockReturnValueOnce(85) // opp3

      const context = await setupApiTest('GET', '/api/opportunities/search', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const response = await GET(context.request)
      const data = await response.json()
      
      // Should be sorted by match score descending: opp2 (95), opp3 (85), opp1 (75)
      expect(data.opportunities.map((o: any) => o.id)).toEqual(['opp2', 'opp3', 'opp1'])
      expect(data.opportunities.map((o: any) => o.matchScore)).toEqual([95, 85, 75])

      await context.cleanup()
    })
  })

  describe('Caching', () => {
    it('should return cached results when available', async () => {
      const cachedResult = {
        opportunities: [createMockOpportunity()],
        count: 1
      }
      mockSearchCache.getWithStats.mockReturnValue(cachedResult)

      const context = await setupApiTest('GET', '/api/opportunities/search', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const response = await GET(context.request)
      const data = await response.json()
      
      expect(data.opportunities).toEqual(cachedResult.opportunities)
      expect(data.totalCount).toBe(cachedResult.count)
      
      // Should not call database when cache hit
      expect(mockGetOpportunities).not.toHaveBeenCalled()

      await context.cleanup()
    })

    it('should cache results after database query', async () => {
      const context = await setupApiTest('GET', '/api/opportunities/search', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      await GET(context.request)
      
      expect(mockSearchCache.set).toHaveBeenCalledWith(
        'test-cache-key',
        expect.objectContaining({
          opportunities: expect.any(Array),
          count: expect.any(Number)
        }),
        300 // Default TTL
      )

      await context.cleanup()
    })

    it('should extend cache TTL when quota is low', async () => {
      // Mock low quota
      const mockQuotaManager = getSAMQuotaManager()
      ;(mockQuotaManager.getQuotaStatus as jest.Mock).mockResolvedValue({
        daily: { remaining: 150, used: 350 }
      })

      const context = await setupApiTest('GET', '/api/opportunities/search', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      await GET(context.request)
      
      expect(mockSearchCache.set).toHaveBeenCalledWith(
        'test-cache-key',
        expect.any(Object),
        1800 // Extended TTL
      )

      await context.cleanup()
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockGetOpportunities.mockResolvedValue({
        data: null,
        count: 0,
        error: new Error('Database connection failed')
      })

      const context = await setupApiTest('GET', '/api/opportunities/search', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const response = await GET(context.request)
      
      await assertApiError(response, 500, 'DATABASE_ERROR')

      await context.cleanup()
    })

    it('should handle profile fetch errors', async () => {
      const context = await setupApiTest('GET', '/api/opportunities/search', {
        user: { id: 'test-user' },
        mockData: {
          profile: null // Simulate profile fetch error
        }
      })

      // Mock the Supabase client to return an error
      const mockSupabase = context.mockSupabase as any
      mockSupabase.from().select().eq().single = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Profile fetch failed')
      })

      const response = await GET(context.request)
      
      await assertApiError(response, 500, 'DATABASE_ERROR')

      await context.cleanup()
    })
  })

  describe('Response Format', () => {
    it('should return properly formatted response', async () => {
      const mockOpportunity = createMockOpportunity()
      mockGetOpportunities.mockResolvedValue({
        data: [mockOpportunity],
        count: 25,
        error: null
      })

      const context = await setupApiTest('GET', '/api/opportunities/search?limit=10&offset=0', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const response = await GET(context.request)
      const data = await response.json()
      
      expect(data).toMatchObject({
        opportunities: expect.any(Array),
        totalCount: 25,
        hasMore: true,
        nextOffset: 10,
        filters: expect.objectContaining({
          limit: 10,
          offset: 0,
          naicsCodes: expect.any(Array)
        }),
        quotaStatus: expect.objectContaining({
          remaining: expect.any(Number),
          total: expect.any(Number),
          warningThreshold: 200
        })
      })

      await context.cleanup()
    })

    it('should indicate when there are no more results', async () => {
      mockGetOpportunities.mockResolvedValue({
        data: [createMockOpportunity()],
        count: 1,
        error: null
      })

      const context = await setupApiTest('GET', '/api/opportunities/search?limit=10&offset=0', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const response = await GET(context.request)
      const data = await response.json()
      
      expect(data.hasMore).toBe(false)
      expect(data.nextOffset).toBe(null)

      await context.cleanup()
    })
  })
})