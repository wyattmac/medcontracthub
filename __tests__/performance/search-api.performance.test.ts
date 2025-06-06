/**
 * Performance Tests: Search API
 * Tests response times, memory usage, and load handling for search endpoints
 */

import { GET as searchHandler } from '@/app/api/opportunities/search/route'
import {
  measureApiPerformance,
  runLoadTest,
  validatePerformance,
  generatePerformanceReport,
  PERFORMANCE_THRESHOLDS
} from '../utils/performance-test-helper'
import { setupApiTest, createMockOpportunity, createMockProfile } from '../utils/api-test-helper'

// Mock dependencies for performance testing
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
    getWithStats: jest.fn().mockReturnValue(null), // Force DB queries for performance testing
    set: jest.fn()
  },
  createCacheKey: jest.fn().mockReturnValue('test-cache-key')
}))

import { getOpportunitiesFromDatabase, calculateOpportunityMatch } from '@/lib/sam-gov/utils'

const mockGetOpportunities = getOpportunitiesFromDatabase as jest.MockedFunction<typeof getOpportunitiesFromDatabase>
const mockCalculateMatch = calculateOpportunityMatch as jest.MockedFunction<typeof calculateOpportunityMatch>

describe('Search API Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks for performance testing
    mockCalculateMatch.mockReturnValue(85)
  })

  describe('Single Request Performance', () => {
    it('should respond within acceptable time limits for basic search', async () => {
      // Mock small dataset
      const mockOpportunities = Array.from({ length: 25 }, (_, i) => 
        createMockOpportunity({ id: `opp-${i}` })
      )
      
      mockGetOpportunities.mockResolvedValue({
        data: mockOpportunities,
        count: 25,
        error: null
      })

      const context = await setupApiTest('GET', '/api/opportunities/search?q=medical', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const metrics = await measureApiPerformance(searchHandler, context.request)
      const validation = validatePerformance(metrics, PERFORMANCE_THRESHOLDS.search)
      
      console.log(generatePerformanceReport('Basic Search', metrics, PERFORMANCE_THRESHOLDS.search))
      
      expect(validation.passed).toBe(true)
      if (!validation.passed) {
        console.error('Performance failures:', validation.failures)
      }

      await context.cleanup()
    }, 10000) // 10 second timeout

    it('should handle large result sets efficiently', async () => {
      // Mock large dataset
      const mockOpportunities = Array.from({ length: 100 }, (_, i) => 
        createMockOpportunity({ id: `opp-${i}` })
      )
      
      mockGetOpportunities.mockResolvedValue({
        data: mockOpportunities,
        count: 1000, // Simulate large total count
        error: null
      })

      const context = await setupApiTest('GET', '/api/opportunities/search?limit=100', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const metrics = await measureApiPerformance(searchHandler, context.request)
      
      console.log(generatePerformanceReport('Large Result Set', metrics))
      
      // Large datasets should still be reasonably fast
      expect(metrics.responseTime).toBeLessThan(5000) // 5 seconds max
      expect(metrics.memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024) // 100MB max

      await context.cleanup()
    }, 15000)

    it('should efficiently calculate match scores for multiple opportunities', async () => {
      const mockOpportunities = Array.from({ length: 50 }, (_, i) => 
        createMockOpportunity({ id: `opp-${i}`, naics_code: `33911${i % 9}` })
      )
      
      mockGetOpportunities.mockResolvedValue({
        data: mockOpportunities,
        count: 50,
        error: null
      })

      // Mock varying match scores
      mockCalculateMatch.mockImplementation(() => Math.floor(Math.random() * 40) + 60)

      const context = await setupApiTest('GET', '/api/opportunities/search', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile({
            companies: { naics_codes: ['339112', '334510', '339113'] }
          })
        }
      })

      const startTime = Date.now()
      const response = await searchHandler(context.request)
      const endTime = Date.now()
      
      const data = await response.json()
      
      console.log(`Match score calculation for ${data.opportunities.length} opportunities: ${endTime - startTime}ms`)
      
      // Should be very fast for match score calculations
      expect(endTime - startTime).toBeLessThan(1000) // 1 second
      expect(data.opportunities).toHaveLength(50)
      expect(data.opportunities[0]).toHaveProperty('matchScore')

      await context.cleanup()
    })
  })

  describe('Load Testing', () => {
    it('should handle concurrent search requests', async () => {
      const mockOpportunities = Array.from({ length: 25 }, (_, i) => 
        createMockOpportunity({ id: `opp-${i}` })
      )
      
      mockGetOpportunities.mockResolvedValue({
        data: mockOpportunities,
        count: 25,
        error: null
      })

      // Create a test handler that includes auth context
      const testHandler = async (request: any) => {
        const context = await setupApiTest('GET', '/api/opportunities/search', {
          user: { id: 'test-user' },
          mockData: {
            profile: createMockProfile()
          }
        })
        
        const response = await searchHandler(context.request)
        await context.cleanup()
        return response
      }

      const loadTestConfig = {
        concurrency: 5,
        duration: 10, // 10 seconds
        rampUpTime: 2
      }

      const metrics = await runLoadTest(
        testHandler,
        '/api/opportunities/search?q=medical',
        loadTestConfig
      )

      console.log(generatePerformanceReport('Concurrent Search Load Test', metrics, PERFORMANCE_THRESHOLDS.search))
      
      expect(metrics.requestsPerSecond).toBeGreaterThan(2) // At least 2 RPS
      expect(metrics.errorRate).toBeLessThan(0.05) // Less than 5% errors
      
    }, 30000) // 30 second timeout for load test

    it('should maintain performance with complex filters', async () => {
      const mockOpportunities = Array.from({ length: 25 }, (_, i) => 
        createMockOpportunity({ 
          id: `opp-${i}`,
          place_of_performance_state: i % 2 === 0 ? 'CA' : 'TX',
          naics_code: `33911${i % 3}`
        })
      )
      
      mockGetOpportunities.mockResolvedValue({
        data: mockOpportunities,
        count: 25,
        error: null
      })

      const context = await setupApiTest('GET', '/api/opportunities/search?q=medical&state=CA&naics=339112&status=active&limit=25', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const metrics = await measureApiPerformance(searchHandler, context.request)
      
      console.log(generatePerformanceReport('Complex Filters Search', metrics))
      
      // Complex filters should still be fast
      expect(metrics.responseTime).toBeLessThan(3000) // 3 seconds max

      await context.cleanup()
    })
  })

  describe('Memory Efficiency', () => {
    it('should not leak memory with repeated searches', async () => {
      const mockOpportunities = Array.from({ length: 10 }, (_, i) => 
        createMockOpportunity({ id: `opp-${i}` })
      )
      
      mockGetOpportunities.mockResolvedValue({
        data: mockOpportunities,
        count: 10,
        error: null
      })

      const initialMemory = process.memoryUsage()
      
      // Perform multiple searches
      for (let i = 0; i < 10; i++) {
        const context = await setupApiTest('GET', `/api/opportunities/search?q=test${i}`, {
          user: { id: 'test-user' },
          mockData: {
            profile: createMockProfile()
          }
        })

        await searchHandler(context.request)
        await context.cleanup()
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }
      
      const finalMemory = process.memoryUsage()
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed
      
      console.log(`Memory growth after 10 searches: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`)
      
      // Memory growth should be minimal
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024) // Less than 50MB growth
    })
  })

  describe('Caching Performance Impact', () => {
    it('should significantly improve performance with cache hits', async () => {
      const mockOpportunities = Array.from({ length: 25 }, (_, i) => 
        createMockOpportunity({ id: `opp-${i}` })
      )
      
      // First request (cache miss)
      mockGetOpportunities.mockResolvedValue({
        data: mockOpportunities,
        count: 25,
        error: null
      })

      const context1 = await setupApiTest('GET', '/api/opportunities/search?q=medical', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const metrics1 = await measureApiPerformance(searchHandler, context1.request)
      await context1.cleanup()

      // Mock cache hit for second request
      const { searchCache } = require('@/lib/utils/cache')
      searchCache.getWithStats.mockReturnValue({
        opportunities: mockOpportunities,
        count: 25
      })

      const context2 = await setupApiTest('GET', '/api/opportunities/search?q=medical', {
        user: { id: 'test-user' },
        mockData: {
          profile: createMockProfile()
        }
      })

      const metrics2 = await measureApiPerformance(searchHandler, context2.request)
      await context2.cleanup()

      console.log(`Cache miss: ${metrics1.responseTime.toFixed(2)}ms`)
      console.log(`Cache hit: ${metrics2.responseTime.toFixed(2)}ms`)
      console.log(`Performance improvement: ${((metrics1.responseTime - metrics2.responseTime) / metrics1.responseTime * 100).toFixed(1)}%`)
      
      // Cache hit should be significantly faster
      expect(metrics2.responseTime).toBeLessThan(metrics1.responseTime * 0.5) // At least 50% faster
    })
  })
})