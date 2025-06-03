/**
 * Tests for Saved Opportunities API
 * GET /api/opportunities/saved
 */

import { GET } from '@/app/api/opportunities/saved/route'
import { createMockNextRequest, mockUser, mockSavedOpportunity, mockOpportunity, extractResponseJson } from '../../utils/api-test-utils'

// Mock calculateOpportunityMatch
const mockCalculateOpportunityMatch = jest.fn().mockReturnValue(0.85)
jest.mock('@/lib/sam-gov/utils', () => ({
  calculateOpportunityMatch: mockCalculateOpportunityMatch
}))

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn()
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createServerComponentClient: jest.fn(() => mockSupabaseClient)
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

describe('/api/opportunities/saved', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default auth success
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })
  })

  describe('Authentication', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/saved')
      const response = await GET(request)
      
      expect(response.status).toBe(401)
    })
  })

  describe('Successful retrieval', () => {
    beforeEach(() => {
      // Mock profile with company
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              company_id: 'company-123',
              companies: { naics_codes: ['334510', '621999'] }
            },
            error: null
          })
        })
    })

    it('should return all saved opportunities with default sorting', async () => {
      const savedOpportunities = [
        {
          ...mockSavedOpportunity,
          id: 'saved-1',
          notes: 'Test notes 1',
          tags: ['medical', 'priority'],
          is_pursuing: true,
          reminder_date: '2024-12-15T10:00:00Z',
          opportunities: {
            ...mockOpportunity,
            id: 'opp-1',
            response_deadline: '2024-12-31T23:59:59Z'
          }
        },
        {
          ...mockSavedOpportunity,
          id: 'saved-2',
          notes: 'Test notes 2',
          tags: ['equipment'],
          is_pursuing: false,
          reminder_date: null,
          opportunities: {
            ...mockOpportunity,
            id: 'opp-2',
            response_deadline: '2024-06-30T23:59:59Z'
          }
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: savedOpportunities,
          error: null,
          count: 2
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              company_id: 'company-123',
              companies: { naics_codes: ['334510'] }
            },
            error: null
          })
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockNextRequest('https://example.com/api/opportunities/saved')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        opportunities: expect.arrayContaining([
          expect.objectContaining({
            id: 'saved-1',
            notes: 'Test notes 1',
            tags: ['medical', 'priority'],
            is_pursuing: true,
            opportunity: expect.objectContaining({
              id: 'opp-1',
              matchScore: 0.85
            })
          }),
          expect.objectContaining({
            id: 'saved-2',
            notes: 'Test notes 2',
            tags: ['equipment'],
            is_pursuing: false,
            opportunity: expect.objectContaining({
              id: 'opp-2',
              matchScore: 0.85
            })
          })
        ]),
        totalCount: 2,
        availableTags: expect.arrayContaining(['equipment', 'medical', 'priority']),
        stats: {
          total: 2,
          pursuing: 1,
          withReminders: 1,
          expiringSoon: expect.any(Number)
        }
      })

      // Should be sorted by deadline (earliest first)
      expect(data.opportunities[0].opportunity.id).toBe('opp-2') // June deadline
      expect(data.opportunities[1].opportunity.id).toBe('opp-1') // December deadline
    })

    it('should filter by pursuing status', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      }

      mockQuery.eq.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { company_id: 'company-123', companies: { naics_codes: [] } },
            error: null
          })
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockNextRequest('https://example.com/api/opportunities/saved', {
        searchParams: { is_pursuing: 'true' }
      })

      await GET(request)

      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUser.id)
      expect(mockQuery.eq).toHaveBeenCalledWith('is_pursuing', true)
    })

    it('should filter by reminder status', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis()
      }

      mockQuery.not.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { company_id: 'company-123', companies: { naics_codes: [] } },
            error: null
          })
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockNextRequest('https://example.com/api/opportunities/saved', {
        searchParams: { has_reminder: 'true' }
      })

      await GET(request)

      expect(mockQuery.not).toHaveBeenCalledWith('reminder_date', 'is', null)
    })

    it('should filter by tags', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        overlaps: jest.fn().mockReturnThis()
      }

      mockQuery.overlaps.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { company_id: 'company-123', companies: { naics_codes: [] } },
            error: null
          })
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockNextRequest('https://example.com/api/opportunities/saved', {
        searchParams: { tags: 'medical,priority' }
      })

      await GET(request)

      expect(mockQuery.overlaps).toHaveBeenCalledWith('tags', ['medical', 'priority'])
    })
  })

  describe('Sorting', () => {
    const mockSavedOpportunities = [
      {
        ...mockSavedOpportunity,
        id: 'saved-1',
        created_at: '2024-01-01T00:00:00Z',
        opportunities: {
          ...mockOpportunity,
          response_deadline: '2024-12-31T23:59:59Z'
        }
      },
      {
        ...mockSavedOpportunity,
        id: 'saved-2',
        created_at: '2024-02-01T00:00:00Z',
        opportunities: {
          ...mockOpportunity,
          response_deadline: '2024-06-30T23:59:59Z'
        }
      }
    ]

    beforeEach(() => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: mockSavedOpportunities,
          error: null,
          count: 2
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { company_id: 'company-123', companies: { naics_codes: [] } },
            error: null
          })
        })
        .mockReturnValueOnce(mockQuery)
    })

    it('should sort by deadline (default)', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/saved')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      // Earlier deadline should come first
      expect(data.opportunities[0].id).toBe('saved-2') // June deadline
      expect(data.opportunities[1].id).toBe('saved-1') // December deadline
    })

    it('should sort by saved date', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/saved', {
        searchParams: { sort_by: 'saved_date' }
      })
      const response = await GET(request)
      const data = await extractResponseJson(response)

      // More recently saved should come first
      expect(data.opportunities[0].id).toBe('saved-2') // February 2024
      expect(data.opportunities[1].id).toBe('saved-1') // January 2024
    })

    it('should sort by match score', async () => {
      mockCalculateOpportunityMatch
        .mockReturnValueOnce(0.9)  // saved-1
        .mockReturnValueOnce(0.7)  // saved-2

      const request = createMockNextRequest('https://example.com/api/opportunities/saved', {
        searchParams: { sort_by: 'match_score' }
      })
      const response = await GET(request)
      const data = await extractResponseJson(response)

      // Higher match score should come first
      expect(data.opportunities[0].id).toBe('saved-1') // 0.9 match
      expect(data.opportunities[1].id).toBe('saved-2') // 0.7 match
    })
  })

  describe('Statistics and metadata', () => {
    it('should calculate correct statistics', async () => {
      const now = new Date()
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      const savedOpportunities = [
        {
          ...mockSavedOpportunity,
          is_pursuing: true,
          reminder_date: tomorrow.toISOString(),
          opportunities: {
            ...mockOpportunity,
            response_deadline: tomorrow.toISOString() // Expiring soon
          }
        },
        {
          ...mockSavedOpportunity,
          is_pursuing: false,
          reminder_date: null,
          opportunities: {
            ...mockOpportunity,
            response_deadline: '2025-12-31T23:59:59Z' // Not expiring soon
          }
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: savedOpportunities,
          error: null,
          count: 2
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { company_id: 'company-123', companies: { naics_codes: [] } },
            error: null
          })
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockNextRequest('https://example.com/api/opportunities/saved')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.stats).toEqual({
        total: 2,
        pursuing: 1,
        withReminders: 1,
        expiringSoon: 1
      })

      expect(data.remindersDueSoon).toBe(1)
    })

    it('should extract unique tags', async () => {
      const savedOpportunities = [
        {
          ...mockSavedOpportunity,
          tags: ['medical', 'priority', 'equipment'],
          opportunities: mockOpportunity
        },
        {
          ...mockSavedOpportunity,
          tags: ['medical', 'software'],
          opportunities: mockOpportunity
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: savedOpportunities,
          error: null,
          count: 2
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { company_id: 'company-123', companies: { naics_codes: [] } },
            error: null
          })
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockNextRequest('https://example.com/api/opportunities/saved')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.availableTags).toEqual(['equipment', 'medical', 'priority', 'software'])
    })
  })

  describe('Error handling', () => {
    it('should handle database query errors', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
          count: 0
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { company_id: 'company-123', companies: { naics_codes: [] } },
            error: null
          })
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockNextRequest('https://example.com/api/opportunities/saved')
      const response = await GET(request)

      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Query failed')
    })

    it('should handle unexpected errors', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/saved')
      const response = await GET(request)

      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Internal server error')
      expect(data.details).toBe('Unexpected error')
    })

    it('should handle missing company profile gracefully', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null, // No profile found
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 0
          })
        })

      const request = createMockNextRequest('https://example.com/api/opportunities/saved')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data.opportunities).toEqual([])
    })
  })
})