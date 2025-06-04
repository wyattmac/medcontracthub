/**
 * Tests for Health Check API
 * GET /api/health
 */

import { GET } from '@/app/api/health/route'
import { createMockNextRequest, extractResponseJson } from '@/test-utils/utils/api-test-utils'

// Mock the logger to avoid console output during tests
jest.mock('@/lib/errors/logger', () => ({
  apiLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}))

// Mock Supabase server client
const mockSupabaseClient = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn()
  })
}

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => mockSupabaseClient)
}))

describe('/api/health', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment variables
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Successful Health Checks', () => {
    beforeEach(() => {
      // Set up healthy environment
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
      process.env.SAM_GOV_API_KEY = 'test-sam-key'
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
      process.env.RESEND_API_KEY = 'test-resend-key'
      process.env.NODE_ENV = 'test'
      process.env.npm_package_version = '1.0.0'

      // Mock successful database connection
      mockSupabaseClient.from().select().limit().maybeSingle.mockResolvedValue({
        data: null,
        error: null
      })
    })

    it('should return healthy status when all services are working', async () => {
      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        responseTime: expect.stringMatching(/^\d+ms$/),
        services: {
          database: 'healthy',
          environment: {
            supabase: true,
            samApi: true,
            claudeApi: true,
            resend: true
          }
        },
        version: '1.0.0',
        environment: 'test',
        requestId: expect.any(String)
      })
    })

    it('should include cache control headers', async () => {
      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)

      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
      expect(response.headers.get('X-Request-Id')).toBeTruthy()
    })

    it('should return healthy status with partial environment config', async () => {
      // Only configure essential services
      delete process.env.RESEND_API_KEY
      delete process.env.SAM_GOV_API_KEY

      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.services.environment).toMatchObject({
        supabase: true,
        samApi: false,
        claudeApi: true,
        resend: false
      })
    })
  })

  describe('Degraded Health Checks', () => {
    beforeEach(() => {
      // Set minimal environment
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    })

    it('should return degraded status when database is unhealthy', async () => {
      // Mock database error
      mockSupabaseClient.from().select().limit().maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', details: null, hint: null, code: '500' }
      })

      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(503)
      expect(data.status).toBe('degraded')
      expect(data.services.database).toBe('error')
    })

    it('should return degraded status when database times out', async () => {
      // Mock database timeout
      mockSupabaseClient.from().select().limit().maybeSingle.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 6000)) // Longer than 5s timeout
      )

      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(503)
      expect(data.status).toBe('degraded')
      expect(data.services.database).toBe('error')
    })

    it('should return degraded status when essential environment variables are missing', async () => {
      // Remove all environment variables
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      delete process.env.SUPABASE_SERVICE_ROLE_KEY

      // Mock database error due to missing config
      mockSupabaseClient.from().select().limit().maybeSingle.mockRejectedValue(
        new Error('Missing environment configuration')
      )

      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(503)
      expect(data.status).toBe('degraded')
      expect(data.services.environment.supabase).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock a completely unexpected error
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Unexpected server error')
      })

      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error')
      expect(data.error.message).toContain('Unexpected server error')
    })

    it('should include request ID in error responses', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Test error')
      })

      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.error.requestId).toBeTruthy()
      expect(data.error.requestId).toMatch(/^health_\d+_[a-z0-9]+$/)
    })
  })

  describe('Performance', () => {
    it('should complete health check within reasonable time', async () => {
      const request = createMockNextRequest('https://example.com/api/health')
      const startTime = Date.now()
      
      await GET(request)
      
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should include response time in the response', async () => {
      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.responseTime).toMatch(/^\d+ms$/)
      
      const responseTimeMs = parseInt(data.responseTime.replace('ms', ''))
      expect(responseTimeMs).toBeGreaterThan(0)
      expect(responseTimeMs).toBeLessThan(1000)
    })
  })

  describe('Environment Detection', () => {
    it('should correctly identify environment variables', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
      process.env.SAM_GOV_API_KEY = 'sam-key'
      process.env.ANTHROPIC_API_KEY = 'claude-key'
      process.env.RESEND_API_KEY = 'resend-key'

      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.services.environment).toEqual({
        supabase: true,
        samApi: true,
        claudeApi: true,
        resend: true
      })
    })

    it('should detect missing environment variables', async () => {
      // Only set some variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      // Leave others undefined

      const request = createMockNextRequest('https://example.com/api/health')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.services.environment).toEqual({
        supabase: false, // Missing ANON_KEY and SERVICE_ROLE_KEY
        samApi: false,
        claudeApi: false,
        resend: false
      })
    })
  })

  describe('Logging', () => {
    it('should log health check start and completion', async () => {
      const { apiLogger } = require('@/lib/errors/logger')
      
      const request = createMockNextRequest('https://example.com/api/health')
      await GET(request)

      expect(apiLogger.info).toHaveBeenCalledWith('Health check started', {
        requestId: expect.any(String)
      })
      
      expect(apiLogger.info).toHaveBeenCalledWith('Health check completed', {
        requestId: expect.any(String),
        status: expect.any(String),
        responseTime: expect.any(Number)
      })
    })

    it('should log database connection issues', async () => {
      const { apiLogger } = require('@/lib/errors/logger')
      
      mockSupabaseClient.from().select().limit().maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
      })

      const request = createMockNextRequest('https://example.com/api/health')
      await GET(request)

      expect(apiLogger.warn).toHaveBeenCalledWith('Database health check failed', {
        error: { message: 'Connection failed' },
        requestId: expect.any(String)
      })
    })
  })
})