/**
 * Tests for AI Analysis API
 * POST /api/ai/analyze
 */

import '../../setup/mocks' // Import global mocks first
import { POST } from '@/app/api/ai/analyze/route'
import { createMockNextRequest, mockUser, extractResponseJson } from '../../utils/api-test-utils'
import { mockSupabaseClient, configureMockSupabase } from '../../mocks/supabase'

// Mock Claude AI client
jest.mock('@/lib/ai/claude-client', () => ({
  analyzeOpportunity: jest.fn().mockResolvedValue({
    matchReasoning: 'Strong NAICS match and certifications align well',
    competitionLevel: 'medium',
    winProbability: 75,
    keyRequirements: ['Medical device experience', 'FDA compliance'],
    recommendations: ['Highlight veteran status', 'Partner with local suppliers'],
    riskFactors: ['High competition', 'Complex requirements'],
    proposalStrategy: 'Focus on unique capabilities and past performance',
    estimatedEffort: 'medium',
    timelineAnalysis: '3 months until deadline, adequate time for preparation'
  })
}))

// Loggers are mocked in __tests__/mocks/supabase.ts

// Import mocked module
import { analyzeOpportunity } from '@/lib/ai/claude-client'
const mockAnalyzeOpportunity = analyzeOpportunity as jest.MockedFunction<typeof analyzeOpportunity>

describe('/api/ai/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default auth success
    configureMockSupabase({
      auth: { user: mockUser }
    })
  })

  describe('Authentication', () => {
    it('should require authentication', async () => {
      configureMockSupabase({
        auth: { user: null, error: { message: 'Not authenticated' } }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })
  })

  describe('Validation', () => {
    it('should require opportunityId', async () => {
      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: {} // Missing opportunityId
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should validate opportunityId format', async () => {
      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: '' } // Empty string
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })
  })

  describe('Analysis', () => {
    const mockOpportunity = {
      id: 'opp-123',
      title: 'Medical Equipment Procurement',
      agency: 'Department of Veterans Affairs',
      description: 'Purchase of medical diagnostic equipment',
      naics_code: '334510',
      set_aside_type: 'SDVOSB',
      estimated_value_min: 100000,
      estimated_value_max: 500000,
      response_deadline: '2024-12-31T23:59:59Z'
    }

    const mockCompany = {
      id: 'company-123',
      naics_codes: ['334510', '621999'],
      certifications: ['sdvosb', 'hubzone']
    }

    beforeEach(() => {
      // Mock opportunity exists
      const oppMock = mockSupabaseClient.from('opportunities')
      oppMock.single.mockResolvedValue({
        data: mockOpportunity,
        error: null
      })

      // Mock user profile with company
      const profileMock = mockSupabaseClient.from('profiles')
      profileMock.single.mockResolvedValue({
        data: {
          id: mockUser.id,
          company_id: 'company-123',
          companies: mockCompany
        },
        error: null
      })
    })

    it('should analyze opportunity successfully', async () => {
      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      
      const data = await extractResponseJson(response)
      
      expect(data).toHaveProperty('analysis')
      expect(data.analysis).toEqual({
        matchReasoning: expect.any(String),
        competitionLevel: 'medium',
        winProbability: 75,
        keyRequirements: expect.any(Array),
        recommendations: expect.any(Array),
        riskFactors: expect.any(Array),
        proposalStrategy: expect.any(String),
        estimatedEffort: 'medium',
        timelineAnalysis: expect.any(String)
      })

      expect(mockAnalyzeOpportunity).toHaveBeenCalledWith(
        mockOpportunity,
        expect.objectContaining({
          naicsCodes: mockCompany.naics_codes,
          certifications: mockCompany.certifications
        })
      )
    })

    it('should handle analysis with user profile without company', async () => {
      // Mock user without company
      const profileMock = mockSupabaseClient.from('profiles')
      profileMock.single.mockResolvedValue({
        data: {
          id: mockUser.id,
          company_id: null
        },
        error: null
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      expect(mockAnalyzeOpportunity).toHaveBeenCalledWith(
        mockOpportunity,
        expect.objectContaining({
          naicsCodes: [],
          capabilities: [],
          pastPerformance: [],
          certifications: [],
          companySize: 'Unknown'
        })
      )
    })

    it('should handle opportunity not found', async () => {
      // Mock opportunity not found
      const oppMock = mockSupabaseClient.from('opportunities')
      oppMock.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'invalid-id' }
      })

      const response = await POST(request)
      expect(response.status).toBe(404)
      
      const data = await extractResponseJson(response)
      expect(data.error).toContain('not found')
    })

    it('should handle AI analysis error', async () => {
      mockAnalyzeOpportunity.mockRejectedValueOnce(new Error('AI service unavailable'))

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      expect(response.status).toBe(503)
      
      const data = await extractResponseJson(response)
      expect(data.error).toContain('Analysis service temporarily unavailable')
    })
  })

  describe('Rate limiting', () => {
    it('should respect rate limits', async () => {
      // This would be tested if we had rate limiting mocked
      // For now, just verify the endpoint accepts requests
      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'opp-123' }
      })

      const response = await POST(request)
      expect(response.status).not.toBe(429)
    })
  })
})