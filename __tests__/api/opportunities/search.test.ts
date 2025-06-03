/**
 * Tests for Opportunities Search API
 * GET /api/opportunities/search
 */

import { GET } from '@/app/api/opportunities/search/route'
import {
  createMockNextRequest,
  createMockRouteContext,
  mockUser,
  mockProfile,
  mockCompany,
  mockOpportunity,
  extractResponseJson
} from '../../utils/api-test-utils'

// Mock the route handler
jest.mock('@/lib/api/route-handler', () => ({
  routeHandler: {
    GET: (handler: any, options: any) => {
      return async (request: any) => {
        // Create mock context
        const context = createMockRouteContext({
          request,
          user: mockUser
        })
        
        try {
          return await handler(context)
        } catch (error) {
          return new Response(JSON.stringify({
            error: { message: error.message }
          }), { status: 500 })
        }
      }
    }
  }
}))

// Mock SAM.gov utilities
jest.mock('@/lib/sam-gov/utils', () => ({
  getOpportunitiesFromDatabase: jest.fn(),
  calculateOpportunityMatch: jest.fn()
}))

const mockGetOpportunitiesFromDatabase = require('@/lib/sam-gov/utils').getOpportunitiesFromDatabase
const mockCalculateOpportunityMatch = require('@/lib/sam-gov/utils').calculateOpportunityMatch

// Mock loggers
jest.mock('@/lib/errors/logger', () => ({
  dbLogger: {
    error: jest.fn(),
    warn: jest.fn()
  }
}))

describe('/api/opportunities/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default successful mocks
    mockGetOpportunitiesFromDatabase.mockResolvedValue({
      data: [mockOpportunity],
      error: null,
      count: 1
    })
    
    mockCalculateOpportunityMatch.mockReturnValue(0.85)
  })

  describe('Successful searches', () => {
    it('should return opportunities with default parameters', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        opportunities: [
          expect.objectContaining({
            ...mockOpportunity,
            matchScore: 0.85,
            isSaved: false
          })
        ],
        totalCount: 1,
        hasMore: false,
        nextOffset: null,
        filters: expect.objectContaining({
          limit: 25,
          offset: 0
        })
      })
    })

    it('should handle search query parameter', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { q: 'medical equipment' }
      })
      
      await GET(request)

      expect(mockGetOpportunitiesFromDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: 'medical equipment'
        })
      )
    })

    it('should handle NAICS codes filter', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { naics: '334510,621999' }
      })
      
      await GET(request)

      expect(mockGetOpportunitiesFromDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          naicsCodes: ['334510', '621999']
        })
      )
    })

    it('should handle state filter', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { state: 'CA' }
      })
      
      await GET(request)

      expect(mockGetOpportunitiesFromDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CA'
        })
      )
    })

    it('should handle status filter', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { status: 'active' }
      })
      
      await GET(request)

      expect(mockGetOpportunitiesFromDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active'
        })
      )
    })

    it('should handle deadline filters', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: {
          deadline_from: '2024-01-01T00:00:00Z',
          deadline_to: '2024-12-31T23:59:59Z'
        }
      })
      
      await GET(request)

      expect(mockGetOpportunitiesFromDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          responseDeadlineFrom: '2024-01-01T00:00:00Z',
          responseDeadlineTo: '2024-12-31T23:59:59Z'
        })
      )
    })

    it('should handle pagination parameters', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { limit: '50', offset: '25' }
      })
      
      await GET(request)

      expect(mockGetOpportunitiesFromDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
          offset: 25
        })
      )
    })

    it('should sort opportunities by match score and deadline', async () => {
      const opportunities = [
        { ...mockOpportunity, id: 'opp-1', response_deadline: '2024-12-31T23:59:59Z' },
        { ...mockOpportunity, id: 'opp-2', response_deadline: '2024-06-30T23:59:59Z' },
        { ...mockOpportunity, id: 'opp-3', response_deadline: '2024-12-15T23:59:59Z' }
      ]

      mockGetOpportunitiesFromDatabase.mockResolvedValue({
        data: opportunities,
        error: null,
        count: 3
      })

      // Mock different match scores
      mockCalculateOpportunityMatch
        .mockReturnValueOnce(0.9)  // opp-1: high match
        .mockReturnValueOnce(0.7)  // opp-2: medium match
        .mockReturnValueOnce(0.9)  // opp-3: high match (but earlier deadline)

      const request = createMockNextRequest('https://example.com/api/opportunities/search')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      // Should be sorted by match score (desc), then by deadline (asc)
      expect(data.opportunities[0].id).toBe('opp-3') // 0.9 match, earlier deadline
      expect(data.opportunities[1].id).toBe('opp-1') // 0.9 match, later deadline
      expect(data.opportunities[2].id).toBe('opp-2') // 0.7 match
    })

    it('should use company NAICS codes when no specific NAICS filter provided', async () => {
      // Mock successful profile fetch with company data
      const context = createMockRouteContext({
        user: mockUser,
        supabase: {
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                ...mockProfile,
                companies: mockCompany
              },
              error: null
            })
          })
        }
      })

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.GET = jest.fn((handler, options) => {
        return async (request: any) => {
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/search')
      await GET(request)

      expect(mockGetOpportunitiesFromDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          naicsCodes: mockCompany.naics_codes
        })
      )
    })
  })

  describe('Validation', () => {
    it('should validate limit parameter bounds', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { limit: '150' } // Above max of 100
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(400)
    })

    it('should validate state parameter format', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { state: 'CALIFORNIA' } // Should be 2-letter code
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(400)
    })

    it('should validate status parameter values', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { status: 'invalid_status' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(400)
    })

    it('should validate datetime format for deadline filters', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { deadline_from: 'invalid-date' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(400)
    })
  })

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockGetOpportunitiesFromDatabase.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
        count: 0
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/search')
      const response = await GET(request)
      
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error.message).toContain('Search failed')
    })

    it('should handle missing company profile', async () => {
      const context = createMockRouteContext({
        user: mockUser,
        supabase: {
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Profile not found' }
            })
          })
        }
      })

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.GET = jest.fn((handler, options) => {
        return async (request: any) => {
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/search')
      const response = await GET(request)
      
      expect(response.status).toBe(500)
    })

    it('should handle missing company_id in profile', async () => {
      const context = createMockRouteContext({
        user: mockUser,
        supabase: {
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockProfile, company_id: null },
              error: null
            })
          })
        }
      })

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.GET = jest.fn((handler, options) => {
        return async (request: any) => {
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/search')
      const response = await GET(request)
      
      expect(response.status).toBe(404)
    })
  })

  describe('Match scoring', () => {
    it('should calculate match scores for all opportunities', async () => {
      const opportunities = [
        { ...mockOpportunity, id: 'opp-1' },
        { ...mockOpportunity, id: 'opp-2' }
      ]

      mockGetOpportunitiesFromDatabase.mockResolvedValue({
        data: opportunities,
        error: null,
        count: 2
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/search')
      await GET(request)

      expect(mockCalculateOpportunityMatch).toHaveBeenCalledTimes(2)
      expect(mockCalculateOpportunityMatch).toHaveBeenCalledWith(
        opportunities[0],
        expect.any(Array)
      )
    })

    it('should include saved status in response', async () => {
      const opportunityWithSaved = {
        ...mockOpportunity,
        saved_opportunities: [{ id: 'saved-1' }]
      }

      mockGetOpportunitiesFromDatabase.mockResolvedValue({
        data: [opportunityWithSaved],
        error: null,
        count: 1
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/search')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.opportunities[0].isSaved).toBe(true)
    })
  })

  describe('Pagination', () => {
    it('should indicate if there are more results', async () => {
      mockGetOpportunitiesFromDatabase.mockResolvedValue({
        data: [mockOpportunity],
        error: null,
        count: 100 // Total count
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { limit: '25', offset: '0' }
      })
      
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.hasMore).toBe(true)
      expect(data.nextOffset).toBe(25)
    })

    it('should indicate when there are no more results', async () => {
      mockGetOpportunitiesFromDatabase.mockResolvedValue({
        data: [mockOpportunity],
        error: null,
        count: 1 // Only 1 result total
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/search', {
        searchParams: { limit: '25', offset: '0' }
      })
      
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.hasMore).toBe(false)
      expect(data.nextOffset).toBe(null)
    })
  })
})