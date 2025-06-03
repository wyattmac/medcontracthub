/**
 * Tests for AI Analysis API
 * POST /api/ai/analyze
 */

import { POST } from '@/app/api/ai/analyze/route'
import {
  createMockNextRequest,
  createMockRouteContext,
  mockUser,
  mockProfile,
  mockCompany,
  mockOpportunity,
  mockAIAnalysis,
  extractResponseJson
} from '../../utils/api-test-utils'

// Mock the route handler
jest.mock('@/lib/api/route-handler', () => ({
  routeHandler: {
    POST: (handler: any, options: any) => {
      return async (request: any) => {
        const context = createMockRouteContext({ request, user: mockUser })
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

// Mock Claude AI client
const mockAnalyzeOpportunity = jest.fn()
jest.mock('@/lib/ai/claude-client', () => ({
  analyzeOpportunity: mockAnalyzeOpportunity
}))

// Mock loggers
jest.mock('@/lib/errors/logger', () => ({
  aiLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}))

describe('/api/ai/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default successful mocks
    mockAnalyzeOpportunity.mockResolvedValue(mockAIAnalysis)
  })

  describe('Successful analysis', () => {
    it('should analyze opportunity successfully', async () => {
      const mockSupabase = {
        from: jest.fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOpportunity,
              error: null
            })
          })
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
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [], // No existing analysis
              error: null
            })
          })
          .mockReturnValueOnce({
            insert: jest.fn().mockResolvedValue({
              data: { id: 'analysis-123' },
              error: null
            })
          }),
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        analysis: mockAIAnalysis,
        cached: false,
        analyzedAt: expect.any(String)
      })

      expect(mockAnalyzeOpportunity).toHaveBeenCalledWith(
        mockOpportunity,
        expect.objectContaining({
          naicsCodes: mockCompany.naics_codes,
          capabilities: [mockCompany.description],
          pastPerformance: [],
          certifications: mockCompany.certifications,
          companySize: 'small'
        })
      )
    })

    it('should return cached analysis when available', async () => {
      const existingAnalysis = {
        id: 'analysis-123',
        analysis_result: mockAIAnalysis,
        created_at: '2024-12-01T10:00:00Z'
      }

      const mockSupabase = {
        from: jest.fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOpportunity,
              error: null
            })
          })
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
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [existingAnalysis],
              error: null
            })
          })
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        analysis: mockAIAnalysis,
        cached: true,
        analyzedAt: existingAnalysis.created_at
      })

      // Should not call AI service when cached
      expect(mockAnalyzeOpportunity).not.toHaveBeenCalled()
    })

    it('should cache new analysis in database', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: { id: 'analysis-123' },
        error: null
      })

      const mockSupabase = {
        from: jest.fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOpportunity,
              error: null
            })
          })
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
          }),
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      await POST(request)

      expect(mockInsert).toHaveBeenCalledWith({
        opportunity_id: 'opp-123',
        user_id: mockUser.id,
        analysis_result: mockAIAnalysis,
        analysis_type: 'detailed_opportunity_analysis'
      })
    })

    it('should log audit trail', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: null
      })

      const mockSupabase = {
        from: jest.fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOpportunity,
              error: null
            })
          })
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
          }),
        rpc: mockRpc
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      await POST(request)

      expect(mockRpc).toHaveBeenCalledWith('log_audit', {
        p_action: 'ai_analysis_generated',
        p_entity_type: 'opportunities',
        p_entity_id: 'opp-123',
        p_changes: {
          analysis_type: 'detailed_opportunity_analysis',
          win_probability: mockAIAnalysis.winProbability,
          competition_level: mockAIAnalysis.competitionLevel
        }
      })
    })
  })

  describe('Validation', () => {
    it('should validate opportunityId format', async () => {
      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'invalid-format' } // Not a UUID
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should require opportunityId', async () => {
      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: {} // Missing opportunityId
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })
  })

  describe('Error handling', () => {
    it('should handle opportunity not found', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' }
          })
        })
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      expect(response.status).toBe(404)
    })

    it('should handle missing company profile', async () => {
      const mockSupabase = {
        from: jest.fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOpportunity,
              error: null
            })
          })
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Profile not found' }
            })
          })
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      expect(response.status).toBe(404)
    })

    it('should handle AI analysis timeout', async () => {
      mockAnalyzeOpportunity.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 50000)) // Longer than 45s timeout
      )

      const mockSupabase = {
        from: jest.fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOpportunity,
              error: null
            })
          })
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
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error.message).toContain('timeout')
    }, 10000) // Increase test timeout

    it('should handle AI analysis errors', async () => {
      mockAnalyzeOpportunity.mockRejectedValue(new Error('AI service unavailable'))

      const mockSupabase = {
        from: jest.fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOpportunity,
              error: null
            })
          })
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
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
    })

    it('should continue even if caching fails', async () => {
      const mockSupabase = {
        from: jest.fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOpportunity,
              error: null
            })
          })
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
          }),
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      const data = await extractResponseJson(response)

      // Should still return the analysis even if caching failed
      expect(response.status).toBe(200)
      expect(data.analysis).toEqual(mockAIAnalysis)
    })
  })

  describe('Company profile building', () => {
    it('should build company profile correctly', async () => {
      const company = {
        ...mockCompany,
        description: 'Medical device manufacturing and distribution'
      }

      const mockSupabase = {
        from: jest.fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOpportunity,
              error: null
            })
          })
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                ...mockProfile,
                companies: company
              },
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
          }),
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      await POST(request)

      expect(mockAnalyzeOpportunity).toHaveBeenCalledWith(
        mockOpportunity,
        {
          naicsCodes: company.naics_codes,
          capabilities: [company.description],
          pastPerformance: [],
          certifications: company.certifications,
          companySize: 'small'
        }
      )
    })

    it('should handle missing company data gracefully', async () => {
      const companyWithoutOptionalFields = {
        id: 'company-123',
        name: 'Test Company',
        naics_codes: [],
        certifications: null,
        description: null
      }

      const mockSupabase = {
        from: jest.fn()
          .mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockOpportunity,
              error: null
            })
          })
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
          }),
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      }

      const originalMock = require('@/lib/api/route-handler')
      originalMock.routeHandler.POST = jest.fn((handler, options) => {
        return async (request: any) => {
          const context = createMockRouteContext({
            request,
            user: mockUser,
            supabase: mockSupabase
          })
          return await handler(context)
        }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockAnalyzeOpportunity).toHaveBeenCalledWith(
        mockOpportunity,
        {
          naicsCodes: [],
          capabilities: [],
          pastPerformance: [],
          certifications: [],
          companySize: 'small'
        }
      )
    })
  })
})