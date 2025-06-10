/**
 * Service Layer Test: SAM.gov Client
 * Tests the SAM.gov API integration service
 */

import { SAMApiClient, getSAMApiClient } from '@/lib/sam-gov/client'
import { getSAMQuotaManager } from '@/lib/sam-gov/quota-manager'

// Mock external dependencies
jest.mock('@/lib/redis/client', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn()
  },
  isRedisAvailable: jest.fn(() => false),
  getRedisClient: jest.fn(() => null)
}))

jest.mock('@/lib/errors/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}))

// Mock fetch
global.fetch = jest.fn()
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('SAM.gov Client Service', () => {
  let client: SAMApiClient
  let quotaManager: ReturnType<typeof getSAMQuotaManager>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment
    process.env.SAM_GOV_API_KEY = 'test-api-key'
    
    client = getSAMApiClient()
    quotaManager = getSAMQuotaManager()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Opportunity Search', () => {
    it('should search opportunities with basic parameters', async () => {
      const mockResponse = {
        opportunitiesData: [
          {
            noticeId: 'TEST123456',
            title: 'Medical Equipment Procurement',
            organizationName: 'Department of Veterans Affairs',
            naicsCode: '339112',
            responseDeadLine: '2024-12-31T23:59:59Z',
            postedDate: '2024-01-01T00:00:00Z',
            type: 'Combined Synopsis/Solicitation',
            active: 'Yes'
          }
        ],
        totalRecords: 1
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers({
          'x-ratelimit-remaining': '450',
          'x-ratelimit-total': '500'
        })
      } as Response)

      const searchParams = {
        keyword: 'medical equipment',
        naics: '339112',
        state: 'CA',
        limit: 25,
        offset: 0
      }

      const result = await client.searchOpportunities(searchParams)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.sam.gov'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Api-Key': 'test-api-key',
            'Accept': 'application/json'
          })
        })
      )

      expect(result).toEqual({
        opportunities: expect.arrayContaining([
          expect.objectContaining({
            notice_id: 'TEST123456',
            title: 'Medical Equipment Procurement',
            organization_name: 'Department of Veterans Affairs',
            naics_code: '339112'
          })
        ]),
        totalCount: 1,
        quotaRemaining: 450
      })
    })

    it('should handle NAICS code filtering correctly', async () => {
      const mockResponse = {
        opportunitiesData: [],
        totalRecords: 0
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers()
      } as Response)

      await client.searchOpportunities({
        naics: '339112,334510',
        limit: 25
      })

      const fetchCall = mockFetch.mock.calls[0]
      const url = fetchCall[0] as string
      
      expect(url).toContain('naicsCode=339112,334510')
    })

    it('should handle pagination parameters', async () => {
      const mockResponse = {
        opportunitiesData: [],
        totalRecords: 100
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers()
      } as Response)

      await client.searchOpportunities({
        limit: 50,
        offset: 100
      })

      const fetchCall = mockFetch.mock.calls[0]
      const url = fetchCall[0] as string
      
      expect(url).toContain('limit=50')
      expect(url).toContain('start=100')
    })

    it('should handle date range filtering', async () => {
      const mockResponse = {
        opportunitiesData: [],
        totalRecords: 0
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers()
      } as Response)

      await client.searchOpportunities({
        responseDeadlineFrom: '2024-01-01',
        responseDeadlineTo: '2024-12-31'
      })

      const fetchCall = mockFetch.mock.calls[0]
      const url = fetchCall[0] as string
      
      expect(url).toContain('responseDeadLineFrom=2024-01-01')
      expect(url).toContain('responseDeadLineTo=2024-12-31')
    })
  })

  describe('Rate Limiting and Quota Management', () => {
    it('should track quota usage from response headers', async () => {
      const mockResponse = {
        opportunitiesData: [],
        totalRecords: 0
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers({
          'x-ratelimit-remaining': '245',
          'x-ratelimit-total': '500'
        })
      } as Response)

      const result = await client.searchOpportunities({ limit: 10 })

      expect(result.quotaRemaining).toBe(245)
    })

    it('should handle quota exhaustion gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({ message: 'API quota exceeded' }),
        headers: new Headers({
          'x-ratelimit-remaining': '0',
          'retry-after': '3600'
        })
      } as Response)

      await expect(client.searchOpportunities({ limit: 10 }))
        .rejects
        .toThrow('API quota exceeded')
    })

    it('should implement exponential backoff for rate limit errors', async () => {
      // First call - rate limited
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: () => Promise.resolve({ message: 'Rate limited' }),
          headers: new Headers({ 'retry-after': '1' })
        } as Response)
        // Second call - successful
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ opportunitiesData: [], totalRecords: 0 }),
          headers: new Headers()
        } as Response)

      const startTime = Date.now()
      await client.searchOpportunities({ limit: 10 })
      const endTime = Date.now()

      // Should have waited at least 1 second for retry
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(client.searchOpportunities({ limit: 10 }))
        .rejects
        .toThrow('Network error')
    })

    it('should handle invalid API responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalidFormat: true }),
        headers: new Headers()
      } as Response)

      await expect(client.searchOpportunities({ limit: 10 }))
        .rejects
        .toThrow('Invalid API response format')
    })

    it('should handle API errors with proper error codes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ 
          error: 'Internal server error',
          code: 'SERVER_ERROR'
        }),
        headers: new Headers()
      } as Response)

      await expect(client.searchOpportunities({ limit: 10 }))
        .rejects
        .toThrow('Internal server error')
    })

    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Invalid API key' }),
        headers: new Headers()
      } as Response)

      await expect(client.searchOpportunities({ limit: 10 }))
        .rejects
        .toThrow('Invalid API key')
    })
  })

  describe('Caching', () => {
    it('should cache search results', async () => {
      const { redisClient } = require('@/lib/redis/client')
      
      // Mock cache miss
      redisClient.get.mockResolvedValue(null)
      
      const mockResponse = {
        opportunitiesData: [
          {
            noticeId: 'TEST123',
            title: 'Test Opportunity'
          }
        ],
        totalRecords: 1
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers()
      } as Response)

      const searchParams = { keyword: 'medical', limit: 10 }
      await client.searchOpportunities(searchParams)

      // Should cache the result
      expect(redisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('sam:search:'),
        expect.stringContaining('TEST123'),
        'EX',
        300 // 5 minutes TTL
      )
    })

    it('should return cached results when available', async () => {
      const { redisClient } = require('@/lib/redis/client')
      
      const cachedResult = JSON.stringify({
        opportunities: [{ notice_id: 'CACHED123', title: 'Cached Opportunity' }],
        totalCount: 1,
        quotaRemaining: 450
      })
      
      redisClient.get.mockResolvedValue(cachedResult)

      const result = await client.searchOpportunities({ keyword: 'medical' })

      expect(result.opportunities[0].notice_id).toBe('CACHED123')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should invalidate cache on API errors', async () => {
      const { redisClient } = require('@/lib/redis/client')
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
        headers: new Headers()
      } as Response)

      try {
        await client.searchOpportunities({ keyword: 'medical' })
      } catch (error) {
        // Expected error
      }

      expect(redisClient.del).toHaveBeenCalledWith(
        expect.stringContaining('sam:search:')
      )
    })
  })

  describe('Data Transformation', () => {
    it('should correctly transform SAM.gov API response to internal format', async () => {
      const samResponse = {
        opportunitiesData: [
          {
            noticeId: 'TEST123456',
            title: 'Medical Equipment Procurement',
            organizationName: 'Department of Veterans Affairs',
            naicsCode: '339112',
            responseDeadLine: '2024-12-31T23:59:59.000+0000',
            postedDate: '2024-01-01T00:00:00.000+0000',
            type: 'Combined Synopsis/Solicitation',
            active: 'Yes',
            award: {
              amount: '$1,000,000'
            },
            pointOfContact: [
              {
                fullName: 'John Doe',
                email: 'john.doe@va.gov'
              }
            ],
            placeOfPerformance: {
              state: 'CA'
            },
            description: 'Procurement of medical diagnostic equipment...'
          }
        ],
        totalRecords: 1
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(samResponse),
        headers: new Headers()
      } as Response)

      const result = await client.searchOpportunities({ limit: 10 })
      const opportunity = result.opportunities[0]

      expect(opportunity).toEqual({
        notice_id: 'TEST123456',
        title: 'Medical Equipment Procurement',
        organization_name: 'Department of Veterans Affairs',
        naics_code: '339112',
        response_deadline: '2024-12-31T23:59:59Z',
        posted_date: '2024-01-01T00:00:00Z',
        type: 'Combined Synopsis/Solicitation',
        active: true,
        award_amount: 1000000,
        contact_name: 'John Doe',
        contact_email: 'john.doe@va.gov',
        place_of_performance_state: 'CA',
        description: 'Procurement of medical diagnostic equipment...',
        link: expect.stringContaining('sam.gov')
      })
    })

    it('should handle missing optional fields gracefully', async () => {
      const samResponse = {
        opportunitiesData: [
          {
            noticeId: 'TEST123',
            title: 'Basic Opportunity',
            active: 'Yes'
            // Missing many optional fields
          }
        ],
        totalRecords: 1
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(samResponse),
        headers: new Headers()
      } as Response)

      const result = await client.searchOpportunities({ limit: 10 })
      const opportunity = result.opportunities[0]

      expect(opportunity.notice_id).toBe('TEST123')
      expect(opportunity.title).toBe('Basic Opportunity')
      expect(opportunity.organization_name).toBeUndefined()
      expect(opportunity.contact_email).toBeUndefined()
    })

    it('should parse award amounts correctly', async () => {
      const testCases = [
        { input: '$1,000,000', expected: 1000000 },
        { input: '$500K', expected: 500000 },
        { input: '$2.5M', expected: 2500000 },
        { input: 'TBD', expected: null },
        { input: '', expected: null }
      ]

      for (const testCase of testCases) {
        const samResponse = {
          opportunitiesData: [
            {
              noticeId: 'TEST123',
              title: 'Test',
              award: { amount: testCase.input }
            }
          ],
          totalRecords: 1
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(samResponse),
          headers: new Headers()
        } as Response)

        const result = await client.searchOpportunities({ limit: 10 })
        expect(result.opportunities[0].award_amount).toBe(testCase.expected)
      }
    })
  })
})