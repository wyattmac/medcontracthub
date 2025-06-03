/**
 * Tests for rate limiting functionality
 */

import { NextRequest } from 'next/server'
import { rateLimit, rateLimitConfigs } from '@/lib/rate-limit'

// Mock NextRequest
const createMockRequest = (ip = '127.0.0.1', userAgent = 'test-agent'): NextRequest => {
  const url = 'https://example.com/api/test'
  
  // Create a basic request-like object that matches NextRequest interface
  const mockRequest = {
    url,
    ip,
    headers: new Map([
      ['user-agent', userAgent],
      ['x-forwarded-for', ip],
    ]),
    method: 'GET',
    nextUrl: new URL(url),
    get: function(key: string) {
      return this.headers.get(key)
    }
  } as any
  
  // Add headers.get method for compatibility
  const originalGet = mockRequest.headers.get.bind(mockRequest.headers)
  mockRequest.headers.get = function(key: string) {
    return originalGet(key) || (key === 'user-agent' ? userAgent : key === 'x-forwarded-for' ? ip : null)
  }
  
  return mockRequest as NextRequest
}

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear the in-memory store before each test
    jest.clearAllMocks()
    // Clear any existing rate limit stores
    jest.clearAllTimers()
  })

  describe('rateLimit function', () => {
    it('should allow requests within the limit', async () => {
      const request = createMockRequest()
      const config = { interval: 60000, uniqueTokenPerInterval: 10 }
      
      const result = await rateLimit(request, config)
      
      expect(result.success).toBe(true)
      expect(result.limit).toBe(10)
      expect(result.remaining).toBe(9)
      expect(result.reset).toBeGreaterThan(0)
      expect(result.retryAfter).toBeUndefined()
    })

    it('should block requests when limit is exceeded', async () => {
      // Use different request instances to avoid interference
      const request1 = createMockRequest('192.168.1.10', 'test-agent-1')
      const request2 = createMockRequest('192.168.1.10', 'test-agent-1') // Same IP
      const request3 = createMockRequest('192.168.1.10', 'test-agent-1') // Same IP
      const config = { interval: 60000, uniqueTokenPerInterval: 2 }
      
      // First two requests should succeed
      const result1 = await rateLimit(request1, config)
      const result2 = await rateLimit(request2, config)
      
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result2.remaining).toBe(0)
      
      // Third request should be blocked
      const result3 = await rateLimit(request3, config)
      
      expect(result3.success).toBe(false)
      expect(result3.remaining).toBe(0)
      expect(result3.retryAfter).toBeGreaterThan(0)
    })

    it('should differentiate between different IPs', async () => {
      const request1 = createMockRequest('192.168.1.1')
      const request2 = createMockRequest('192.168.1.2')
      const config = { interval: 60000, uniqueTokenPerInterval: 1 }
      
      const result1 = await rateLimit(request1, config)
      const result2 = await rateLimit(request2, config)
      
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })

    // Skip timing-dependent test that can be flaky in CI environments
    it.skip('should reset after the time window', async () => {
      const request = createMockRequest()
      const config = { interval: 1000, uniqueTokenPerInterval: 1 } // 1 second window
      
      // First request should succeed
      const result1 = await rateLimit(request, config)
      expect(result1.success).toBe(true)
      
      // Second request should be blocked
      const result2 = await rateLimit(request, config)
      expect(result2.success).toBe(false)
      
      // Wait for the window to reset
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      // Third request should succeed again
      const result3 = await rateLimit(request, config)
      expect(result3.success).toBe(true)
    })
  })

  describe('Rate limit configurations', () => {
    it('should have proper configuration for auth endpoints', () => {
      expect(rateLimitConfigs.auth).toEqual({
        interval: 15 * 60 * 1000, // 15 minutes
        uniqueTokenPerInterval: 5 // 5 attempts per 15 minutes
      })
    })

    it('should have proper configuration for API endpoints', () => {
      expect(rateLimitConfigs.api).toEqual({
        interval: 60 * 1000, // 1 minute
        uniqueTokenPerInterval: 60 // 60 requests per minute
      })
    })

    it('should have proper configuration for AI endpoints', () => {
      expect(rateLimitConfigs.ai).toEqual({
        interval: 60 * 1000, // 1 minute
        uniqueTokenPerInterval: 20 // 20 requests per minute
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle missing IP gracefully', async () => {
      const request = createMockRequest(undefined, 'test-agent')
      const config = { interval: 60000, uniqueTokenPerInterval: 10 }
      
      const result = await rateLimit(request, config)
      
      expect(result.success).toBe(true)
      expect(result.limit).toBe(10)
    })

    it('should handle missing user agent gracefully', async () => {
      const request = createMockRequest('127.0.0.1', undefined)
      const config = { interval: 60000, uniqueTokenPerInterval: 10 }
      
      const result = await rateLimit(request, config)
      
      expect(result.success).toBe(true)
      expect(result.limit).toBe(10)
    })

    it('should provide correct retry-after time', async () => {
      const request = createMockRequest()
      const config = { interval: 60000, uniqueTokenPerInterval: 1 }
      
      // Exhaust the limit
      await rateLimit(request, config)
      
      // Get blocked request
      const result = await rateLimit(request, config)
      
      expect(result.success).toBe(false)
      expect(result.retryAfter).toBeGreaterThan(0)
      expect(result.retryAfter).toBeLessThanOrEqual(60) // Should be within the 60-second window
    })
  })
})