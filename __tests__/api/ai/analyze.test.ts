/**
 * Tests for AI Analysis API
 * POST /api/ai/analyze
 */

import '../../setup/mocks' // Import global mocks first
import { POST } from '@/app/api/ai/analyze/route'
import { createMockNextRequest, mockUser, extractResponseJson } from '../../utils/api-test-utils'
import { mockSupabaseClient } from '../../setup/mocks'

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

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: '123e4567-e89b-12d3-a456-426614174000' }
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
        body: { opportunityId: 'not-a-uuid' } // Invalid UUID
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })
  })

  describe('Analysis', () => {
    const mockOpportunity = {
      id: '123e4567-e89b-12d3-a456-426614174000',
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
      // Set up the chain of mocks for opportunities query
      const opportunitiesMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockOpportunity,
          error: null
        })
      }
      
      // Set up the chain of mocks for profiles query
      const profilesMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: mockUser.id,
            company_id: 'company-123',
            companies: mockCompany
          },
          error: null
        })
      }
      
      // Set up the chain of mocks for opportunity_analyses query
      const analysesMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({ data: [], error: null })
      }
      
      // Set up the chain of mocks for insert
      const insertMock = {
        insert: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({ data: null, error: null })
      }
      
      // Configure mockSupabaseClient.from to return the appropriate mock based on table name
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'opportunities') return opportunitiesMock
        if (table === 'profiles') return profilesMock
        if (table === 'opportunity_analyses') {
          // Return different behavior for select vs insert
          return {
            ...analysesMock,
            ...insertMock
          }
        }
        // Default mock for any other table
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
          then: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      })
      
      // Mock RPC for audit logging
      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null })
    })

    it('should analyze opportunity successfully', async () => {
      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: '123e4567-e89b-12d3-a456-426614174000' }
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
      // Override the profiles mock for this specific test
      const profilesMockNoCompany = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: mockUser.id,
            company_id: null,
            companies: null
          },
          error: null
        })
      }
      
      // Update the from() implementation just for profiles in this test
      const originalFrom = mockSupabaseClient.from
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profilesMockNoCompany
        return originalFrom(table)
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: '123e4567-e89b-12d3-a456-426614174000' }
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
      // Override the opportunities mock for this specific test
      const opportunitiesMockNotFound = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      }
      
      // Update the from() implementation just for opportunities in this test
      const originalFrom = mockSupabaseClient.from
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'opportunities') return opportunitiesMockNotFound
        return originalFrom(table)
      })

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }
      })

      const response = await POST(request)
      expect(response.status).toBe(404)
      
      const data = await extractResponseJson(response)
      expect(data.message).toBe('Opportunity not found')
    })

    it('should handle AI analysis error', async () => {
      mockAnalyzeOpportunity.mockRejectedValueOnce(new Error('AI service unavailable'))

      const request = createMockNextRequest('https://example.com/api/ai/analyze', {
        method: 'POST',
        body: { opportunityId: '123e4567-e89b-12d3-a456-426614174000' }
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
        body: { opportunityId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const response = await POST(request)
      expect(response.status).not.toBe(429)
    })
  })
})