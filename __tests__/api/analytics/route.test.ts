/**
 * API Route Test: /api/analytics
 * Tests for analytics data endpoint
 */

import { GET } from '@/app/api/analytics/route'
import {
  setupApiTest,
  assertApiResponse,
  assertApiError,
  testAuthentication
} from '../../utils/api-test-helper'

describe('/api/analytics', () => {
  describe('Authentication', () => {
    it('should require authentication', async () => {
      await testAuthentication(GET, '/api/analytics')
    })
  })

  describe('Analytics Data', () => {
    it('should return comprehensive analytics data', async () => {
      const mockAnalyticsData = {
        overview: {
          totalOpportunities: 150,
          savedOpportunities: 12,
          activeProposals: 3,
          totalValue: 2500000
        },
        trends: {
          opportunitiesThisMonth: 45,
          opportunitiesLastMonth: 38,
          savesThisMonth: 8,
          savesLastMonth: 6
        },
        distribution: {
          byNAICS: [
            { naics_code: '339112', count: 45, label: 'Surgical Equipment' },
            { naics_code: '334510', count: 32, label: 'Medical Equipment' }
          ],
          byState: [
            { state: 'CA', count: 28 },
            { state: 'TX', count: 22 }
          ],
          byAgency: [
            { agency: 'Department of Veterans Affairs', count: 35 },
            { agency: 'Department of Defense', count: 28 }
          ]
        },
        performance: {
          averageMatchScore: 82.5,
          highMatchOpportunities: 24,
          responseRate: 0.68
        }
      }

      const context = await setupApiTest('GET', '/api/analytics', {
        user: { id: 'test-user' },
        mockData: {
          rpc: mockAnalyticsData
        }
      })

      const response = await GET(context.request)
      
      await assertApiResponse(response, 200, {
        overview: expect.objectContaining({
          totalOpportunities: expect.any(Number),
          savedOpportunities: expect.any(Number),
          activeProposals: expect.any(Number),
          totalValue: expect.any(Number)
        }),
        trends: expect.objectContaining({
          opportunitiesThisMonth: expect.any(Number),
          opportunitiesLastMonth: expect.any(Number)
        }),
        distribution: expect.objectContaining({
          byNAICS: expect.any(Array),
          byState: expect.any(Array),
          byAgency: expect.any(Array)
        }),
        performance: expect.objectContaining({
          averageMatchScore: expect.any(Number)
        })
      })

      await context.cleanup()
    })

    it('should handle empty analytics data', async () => {
      const context = await setupApiTest('GET', '/api/analytics', {
        user: { id: 'test-user' },
        mockData: {
          rpc: {
            overview: {
              totalOpportunities: 0,
              savedOpportunities: 0,
              activeProposals: 0,
              totalValue: 0
            },
            trends: {
              opportunitiesThisMonth: 0,
              opportunitiesLastMonth: 0
            },
            distribution: {
              byNAICS: [],
              byState: [],
              byAgency: []
            },
            performance: {
              averageMatchScore: 0,
              highMatchOpportunities: 0,
              responseRate: 0
            }
          }
        }
      })

      const response = await GET(context.request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.overview.totalOpportunities).toBe(0)
      expect(data.distribution.byNAICS).toHaveLength(0)

      await context.cleanup()
    })
  })

  describe('Date Range Filtering', () => {
    it('should accept date range parameters', async () => {
      const context = await setupApiTest('GET', '/api/analytics?from=2024-01-01&to=2024-12-31', {
        user: { id: 'test-user' },
        mockData: {
          rpc: {
            overview: { totalOpportunities: 100 },
            trends: {},
            distribution: { byNAICS: [], byState: [], byAgency: [] },
            performance: {}
          }
        }
      })

      const response = await GET(context.request)
      
      expect(response.status).toBe(200)

      await context.cleanup()
    })

    it('should validate date format', async () => {
      const context = await setupApiTest('GET', '/api/analytics?from=invalid-date', {
        user: { id: 'test-user' }
      })

      const response = await GET(context.request)
      
      await assertApiError(response, 400, 'VALIDATION_ERROR')

      await context.cleanup()
    })
  })

  describe('NAICS Filtering', () => {
    it('should filter analytics by NAICS codes', async () => {
      const context = await setupApiTest('GET', '/api/analytics?naics=339112,334510', {
        user: { id: 'test-user' },
        mockData: {
          rpc: {
            overview: { totalOpportunities: 50 },
            trends: {},
            distribution: { 
              byNAICS: [
                { naics_code: '339112', count: 30 },
                { naics_code: '334510', count: 20 }
              ],
              byState: [],
              byAgency: []
            },
            performance: {}
          }
        }
      })

      const response = await GET(context.request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.distribution.byNAICS).toHaveLength(2)

      await context.cleanup()
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Analytics query failed')
        })
      }

      const context = await setupApiTest('GET', '/api/analytics', {
        user: { id: 'test-user' }
      })

      context.mockSupabase = mockSupabase as any

      const response = await GET(context.request)
      
      await assertApiError(response, 500, 'DATABASE_ERROR')

      await context.cleanup()
    })

    it('should handle missing user profile', async () => {
      const context = await setupApiTest('GET', '/api/analytics', {
        user: { id: 'test-user' },
        mockData: {
          profile: null
        }
      })

      const mockSupabase = context.mockSupabase as any
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Profile not found')
            })
          })
        })
      })

      const response = await GET(context.request)
      
      await assertApiError(response, 500, 'DATABASE_ERROR')

      await context.cleanup()
    })
  })

  describe('Performance Metrics', () => {
    it('should include performance timing data', async () => {
      const context = await setupApiTest('GET', '/api/analytics', {
        user: { id: 'test-user' },
        mockData: {
          rpc: {
            overview: { totalOpportunities: 100 },
            trends: {},
            distribution: { byNAICS: [], byState: [], byAgency: [] },
            performance: {
              averageMatchScore: 85.5,
              queryExecutionTime: 120
            }
          }
        }
      })

      const response = await GET(context.request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.performance).toHaveProperty('averageMatchScore')

      await context.cleanup()
    })
  })

  describe('Caching Headers', () => {
    it('should include appropriate cache headers', async () => {
      const context = await setupApiTest('GET', '/api/analytics', {
        user: { id: 'test-user' },
        mockData: {
          rpc: {
            overview: { totalOpportunities: 100 },
            trends: {},
            distribution: { byNAICS: [], byState: [], byAgency: [] },
            performance: {}
          }
        }
      })

      const response = await GET(context.request)
      
      expect(response.status).toBe(200)
      // Analytics data can be cached briefly
      expect(response.headers.get('cache-control')).toBeTruthy()

      await context.cleanup()
    })
  })
})