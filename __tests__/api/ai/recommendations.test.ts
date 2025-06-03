/**
 * Tests for AI Recommendations API
 * GET /api/ai/recommendations
 */

import { GET } from '@/app/api/ai/recommendations/route'
import { createMockNextRequest, mockUser, mockProfile, mockCompany, mockOpportunity, extractResponseJson } from '../../utils/api-test-utils'

// Mock AI client
const mockGenerateCompanyRecommendations = jest.fn()
jest.mock('@/lib/ai/claude-client', () => ({
  generateCompanyRecommendations: mockGenerateCompanyRecommendations
}))

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(),
  rpc: jest.fn()
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createServerComponentClient: jest.fn(() => mockSupabaseClient)
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

// Mock recommendations data
const mockRecommendations = {
  highPriorityOpportunities: [
    {
      opportunityId: 'opp-1',
      title: 'Medical Equipment Procurement',
      reason: 'Perfect NAICS match and certification alignment',
      priority: 'high',
      estimatedValue: 500000,
      deadline: '2024-12-31T23:59:59Z'
    }
  ],
  actionableRecommendations: [
    {
      type: 'certification',
      title: 'Consider ISO 13485 Certification',
      description: 'This certification would make you eligible for 15% more opportunities',
      impact: 'high',
      effort: 'medium'
    },
    {
      type: 'partnership',
      title: 'Partner with Software Vendors',
      description: 'Many opportunities require both hardware and software components',
      impact: 'medium',
      effort: 'low'
    }
  ],
  marketInsights: {
    trendingNaicsCodes: ['334510', '621999'],
    averageContractValue: 750000,
    competitionLevel: 'medium',
    seasonalTrends: 'Higher activity in Q4'
  },
  complianceGaps: [
    {
      requirement: 'FAR 52.219-9',
      description: 'Small Business Set-Aside requirements',
      severity: 'medium',
      recommendation: 'Ensure small business certification is current'
    }
  ]
}

describe('/api/ai/recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default auth success
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    // Default successful AI response
    mockGenerateCompanyRecommendations.mockResolvedValue(mockRecommendations)
  })

  describe('Authentication', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })

      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      const response = await GET(request)
      
      expect(response.status).toBe(401)
    })
  })

  describe('Successful recommendations', () => {
    beforeEach(() => {
      // Mock profile fetch
      mockSupabaseClient.from
        .mockReturnValueOnce({
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
        // Mock saved opportunities fetch
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'saved-1',
                user_id: mockUser.id,
                opportunities: mockOpportunity
              }
            ],
            error: null
          })
        })
        // Mock audit logs fetch
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [
              {
                action: 'search_opportunities',
                changes: { filters: { searchQuery: 'medical equipment' } }
              },
              {
                action: 'view_opportunity',
                changes: { opportunityId: 'opp-1' }
              }
            ],
            error: null
          })
        })
        // Mock cached recommendations check
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [], // No cached recommendations
            error: null
          })
        })
        // Mock recommendations caching
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({
            data: { id: 'analysis-123' },
            error: null
          })
        })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null
      })
    })

    it('should generate new recommendations successfully', async () => {
      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        recommendations: mockRecommendations,
        cached: false,
        generatedAt: expect.any(String),
        basedOn: {
          savedOpportunities: 1,
          recentActivity: {
            searchQueries: ['medical equipment'],
            viewedOpportunities: expect.any(Array),
            savedCount: 1
          }
        }
      })

      expect(mockGenerateCompanyRecommendations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'saved-1',
            opportunities: mockOpportunity
          })
        ]),
        expect.objectContaining({
          naicsCodes: mockCompany.naics_codes,
          capabilities: [mockCompany.description],
          certifications: mockCompany.certifications
        }),
        expect.objectContaining({
          searchQueries: ['medical equipment'],
          savedCount: 1
        })
      )
    })

    it('should cache new recommendations', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: { id: 'analysis-123' },
        error: null
      })

      // Reset mocks and setup for this specific test
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { ...mockProfile, companies: mockCompany },
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          insert: mockInsert
        })

      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      await GET(request)

      expect(mockInsert).toHaveBeenCalledWith({
        opportunity_id: null,
        user_id: mockUser.id,
        analysis_result: mockRecommendations,
        analysis_type: 'company_recommendations'
      })
    })

    it('should log audit trail', async () => {
      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      await GET(request)

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('log_audit', {
        p_action: 'ai_recommendations_generated',
        p_entity_type: 'company',
        p_changes: {
          saved_opportunities_count: 1,
          high_priority_count: mockRecommendations.highPriorityOpportunities.length,
          recommendations_count: mockRecommendations.actionableRecommendations.length
        }
      })
    })
  })

  describe('Cached recommendations', () => {
    it('should return cached recommendations when available', async () => {
      const cachedRecommendation = {
        id: 'analysis-123',
        analysis_result: mockRecommendations,
        created_at: '2024-12-01T10:00:00Z'
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { ...mockProfile, companies: mockCompany },
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{ id: 'saved-1', opportunities: mockOpportunity }],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [cachedRecommendation], // Cached recommendations found
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        recommendations: mockRecommendations,
        cached: true,
        generatedAt: cachedRecommendation.created_at
      })

      // Should not call AI service when cached
      expect(mockGenerateCompanyRecommendations).not.toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should handle missing company profile', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Profile not found' }
        })
      })

      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      const response = await GET(request)

      expect(response.status).toBe(404)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Company profile not found')
    })

    it('should handle saved opportunities fetch error', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { ...mockProfile, companies: mockCompany },
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })

      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      const response = await GET(request)

      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Failed to fetch saved opportunities')
    })

    it('should handle AI generation errors', async () => {
      mockGenerateCompanyRecommendations.mockRejectedValue(new Error('AI service unavailable'))

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { ...mockProfile, companies: mockCompany },
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      const response = await GET(request)

      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Recommendations generation failed')
      expect(data.details).toBe('AI service unavailable')
    })

    it('should continue even if caching fails', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { ...mockProfile, companies: mockCompany },
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Cache failed' }
          })
        })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null
      })

      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      const response = await GET(request)

      // Should still return recommendations even if caching failed
      expect(response.status).toBe(200)
      
      const data = await extractResponseJson(response)
      expect(data.recommendations).toEqual(mockRecommendations)
    })
  })

  describe('Activity analysis', () => {
    it('should properly analyze recent activity', async () => {
      const activityLogs = [
        {
          action: 'search_opportunities',
          changes: { filters: { searchQuery: 'medical equipment' } }
        },
        {
          action: 'search_opportunities',
          changes: { filters: { searchQuery: 'surgical supplies' } }
        },
        {
          action: 'search_opportunities',
          changes: { filters: { searchQuery: 'medical equipment' } } // Duplicate
        },
        {
          action: 'view_opportunity',
          changes: { opportunityId: 'opp-1' }
        },
        {
          action: 'save_opportunity',
          changes: { opportunityId: 'opp-1' }
        }
      ]

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { ...mockProfile, companies: mockCompany },
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: activityLogs,
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({
            data: { id: 'analysis-123' },
            error: null
          })
        })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null
      })

      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(mockGenerateCompanyRecommendations).toHaveBeenCalledWith(
        [],
        expect.any(Object),
        expect.objectContaining({
          searchQueries: ['medical equipment', 'surgical supplies'], // Deduplicated
          viewedOpportunities: [{ action: 'view_opportunity', changes: { opportunityId: 'opp-1' } }],
          savedCount: 0
        })
      )
    })

    it('should handle missing company data gracefully', async () => {
      const companyWithoutOptionalFields = {
        id: 'company-123',
        name: 'Test Company',
        naics_codes: null,
        certifications: null,
        description: null
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              ...mockProfile,
              companies: companyWithoutOptionalFields
            },
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({
            data: { id: 'analysis-123' },
            error: null
          })
        })

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null
      })

      const request = createMockNextRequest('https://example.com/api/ai/recommendations')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockGenerateCompanyRecommendations).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          naicsCodes: [],
          capabilities: [],
          certifications: []
        }),
        expect.any(Object)
      )
    })
  })
})