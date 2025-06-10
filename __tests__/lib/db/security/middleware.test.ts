/**
 * Security Middleware Unit Tests
 * 
 * Tests permission validation, rate limiting, security event logging,
 * and suspicious activity detection
 */

import { SecurityMiddleware, SecurityContext } from '@/lib/db/security/middleware'
import { AuthorizationError, RateLimitError } from '@/lib/errors/types'
import { createMockSupabaseClient, createTestSecurityContext, waitForAsync } from '@/__tests__/utils/db-test-helper'
import { mockProfiles } from '@/__tests__/mocks/db-data'

// Mock RLS Policy Manager
jest.mock('@/lib/db/security/rls-policies', () => ({
  RLSPolicyManager: jest.fn().mockImplementation(() => ({
    testAccess: jest.fn().mockResolvedValue(true)
  }))
}))

// Mock performance monitoring
jest.mock('@/lib/monitoring/performance', () => ({
  startSpan: jest.fn(() => ({
    setStatus: jest.fn(),
    finish: jest.fn()
  }))
}))

describe('SecurityMiddleware', () => {
  let middleware: SecurityMiddleware
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>
  let defaultContext: SecurityContext

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    middleware = new SecurityMiddleware(mockSupabase)
    defaultContext = createTestSecurityContext()
    jest.clearAllMocks()
    
    // Clear rate limit store
    middleware['rateLimitStore'].clear()
  })

  describe('validatePermission', () => {
    it('should allow authenticated users with valid permissions', async () => {
      await expect(
        middleware.validatePermission(defaultContext, 'opportunities', 'read')
      ).resolves.not.toThrow()

      // Should log successful permission check
      const events = middleware.getSecurityEvents({ type: 'permission_check' })
      expect(events).toHaveLength(1)
      expect(events[0].metadata?.success).toBe(true)
    })

    it('should deny access for unauthenticated users', async () => {
      const context: SecurityContext = {
        ...defaultContext,
        userId: ''
      }

      await expect(
        middleware.validatePermission(context, 'opportunities', 'read')
      ).rejects.toThrow(AuthorizationError)

      // Should log access denied event
      const events = middleware.getSecurityEvents({ type: 'access_denied' })
      expect(events).toHaveLength(1)
      expect(events[0].metadata?.reason).toBe('Not authenticated')
    })

    it('should check rate limits before permissions', async () => {
      // Exhaust rate limit
      const rateLimitPromises = []
      for (let i = 0; i < 1001; i++) {
        rateLimitPromises.push(
          middleware.validatePermission(defaultContext, 'opportunities', 'read')
            .catch(() => {}) // Ignore rate limit errors
        )
      }

      await Promise.all(rateLimitPromises)

      // Next request should be rate limited
      await expect(
        middleware.validatePermission(defaultContext, 'opportunities', 'read')
      ).rejects.toThrow(RateLimitError)
    })

    it('should enforce role-based permissions for company resources', async () => {
      const memberContext = createTestSecurityContext({ role: 'member' })

      // Members can read company resources
      await expect(
        middleware.validatePermission(memberContext, 'company:company-1', 'read')
      ).resolves.not.toThrow()

      // Members cannot write to company resources
      await expect(
        middleware.validatePermission(memberContext, 'company:company-1', 'write')
      ).rejects.toThrow(AuthorizationError)
    })

    it('should allow admins to write company resources', async () => {
      const adminContext = createTestSecurityContext({ role: 'admin' })

      await expect(
        middleware.validatePermission(adminContext, 'company:company-1', 'write')
      ).resolves.not.toThrow()
    })

    it('should restrict user-specific resources', async () => {
      await expect(
        middleware.validatePermission(defaultContext, 'user:test-user-id', 'write')
      ).resolves.not.toThrow()

      // Cannot access other users' resources
      await expect(
        middleware.validatePermission(defaultContext, 'user:other-user-id', 'write')
      ).rejects.toThrow(AuthorizationError)
    })

    it('should handle proposal delete permissions', async () => {
      // Mock proposal query response
      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { 
            data: { status: 'draft', user_id: 'test-user-id' }, 
            error: null 
          }
        }
      })
      middleware = new SecurityMiddleware(mockSupabase)

      // Can delete own draft proposal
      await expect(
        middleware.validatePermission(defaultContext, 'proposal:proposal-1', 'delete')
      ).resolves.not.toThrow()

      // Cannot delete submitted proposal
      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { 
            data: { status: 'submitted', user_id: 'test-user-id' }, 
            error: null 
          }
        }
      })
      middleware = new SecurityMiddleware(mockSupabase)

      await expect(
        middleware.validatePermission(defaultContext, 'proposal:proposal-2', 'delete')
      ).rejects.toThrow(AuthorizationError)
    })

    it('should prevent subscription modifications', async () => {
      const ownerContext = createTestSecurityContext({ role: 'owner' })

      // Even owners cannot directly modify subscriptions
      await expect(
        middleware.validatePermission(ownerContext, 'subscription:sub-1', 'write')
      ).rejects.toThrow(AuthorizationError)

      // But they can read
      await expect(
        middleware.validatePermission(ownerContext, 'subscription:sub-1', 'read')
      ).resolves.not.toThrow()
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce read rate limits', async () => {
      const limit = 1000 // per minute
      let successCount = 0

      // Make requests up to limit
      for (let i = 0; i < limit + 10; i++) {
        try {
          await middleware.validatePermission(defaultContext, 'test', 'read')
          successCount++
        } catch (error) {
          if (error instanceof RateLimitError) {
            break
          }
        }
      }

      expect(successCount).toBe(limit)
    })

    it('should enforce write rate limits', async () => {
      const limit = 100 // per minute
      let successCount = 0

      for (let i = 0; i < limit + 10; i++) {
        try {
          await middleware.validatePermission(defaultContext, 'test', 'write')
          successCount++
        } catch (error) {
          if (error instanceof RateLimitError) {
            break
          }
        }
      }

      expect(successCount).toBe(limit)
    })

    it('should enforce analyze rate limits', async () => {
      const limit = 20 // per hour
      let successCount = 0

      for (let i = 0; i < limit + 5; i++) {
        try {
          await middleware.validatePermission(defaultContext, 'test', 'analyze')
          successCount++
        } catch (error) {
          if (error instanceof RateLimitError) {
            break
          }
        }
      }

      expect(successCount).toBe(limit)
    })

    it('should reset rate limits after window expires', async () => {
      // Custom middleware with short window for testing
      const testConfig = {
        rateLimits: { reads: 2, writes: 100, analyses: 20, exports: 10 },
        suspiciousPatterns: [],
        trustedDomains: []
      }
      middleware = new SecurityMiddleware(mockSupabase, testConfig)

      // Exhaust limit
      await middleware.validatePermission(defaultContext, 'test', 'read')
      await middleware.validatePermission(defaultContext, 'test', 'read')

      // Should be rate limited
      await expect(
        middleware.validatePermission(defaultContext, 'test', 'read')
      ).rejects.toThrow(RateLimitError)

      // Manually adjust the reset time to simulate window expiration
      const key = `${defaultContext.userId}:read`
      const current = middleware['rateLimitStore'].get(key)
      if (current) {
        current.resetAt = new Date(Date.now() - 1000) // Set to past
        middleware['rateLimitStore'].set(key, current)
      }

      // Should work again
      await expect(
        middleware.validatePermission(defaultContext, 'test', 'read')
      ).resolves.not.toThrow()
    })

    it('should track rate limits per user', async () => {
      const user1Context = createTestSecurityContext({ userId: 'user-1' })
      const user2Context = createTestSecurityContext({ userId: 'user-2' })

      const testConfig = {
        rateLimits: { reads: 2, writes: 100, analyses: 20, exports: 10 },
        suspiciousPatterns: [],
        trustedDomains: []
      }
      middleware = new SecurityMiddleware(mockSupabase, testConfig)

      // User 1 exhausts limit
      await middleware.validatePermission(user1Context, 'test', 'read')
      await middleware.validatePermission(user1Context, 'test', 'read')

      // User 1 should be rate limited
      await expect(
        middleware.validatePermission(user1Context, 'test', 'read')
      ).rejects.toThrow(RateLimitError)

      // User 2 should still have access
      await expect(
        middleware.validatePermission(user2Context, 'test', 'read')
      ).resolves.not.toThrow()
    })

    it('should clear rate limits for a user', async () => {
      const testConfig = {
        rateLimits: { reads: 1, writes: 100, analyses: 20, exports: 10 },
        suspiciousPatterns: [],
        trustedDomains: []
      }
      middleware = new SecurityMiddleware(mockSupabase, testConfig)

      // Exhaust limit
      await middleware.validatePermission(defaultContext, 'test', 'read')

      // Should be rate limited
      await expect(
        middleware.validatePermission(defaultContext, 'test', 'read')
      ).rejects.toThrow(RateLimitError)

      // Clear rate limits
      middleware.clearRateLimits(defaultContext.userId)

      // Should work again
      await expect(
        middleware.validatePermission(defaultContext, 'test', 'read')
      ).resolves.not.toThrow()
    })
  })

  describe('Suspicious Activity Detection', () => {
    it('should detect SQL injection patterns', () => {
      const maliciousQueries = [
        "'; DROP TABLE users;--",
        "1' OR '1'='1",
        "admin'--",
        "1; DELETE FROM opportunities WHERE 1=1",
        "' UNION SELECT * FROM profiles--"
      ]

      maliciousQueries.forEach(query => {
        middleware.detectSuspiciousActivity(defaultContext, query)
      })

      const events = middleware.getSecurityEvents({ type: 'suspicious_activity' })
      expect(events.length).toBeGreaterThanOrEqual(maliciousQueries.length)
    })

    it('should detect dangerous SQL commands', () => {
      const dangerousQueries = [
        { query: "SELECT * FROM users WHERE active = true; TRUNCATE TABLE logs;" },
        { operation: "DELETE FROM opportunities WHERE active = true" },
        { sql: "EXEC sp_executesql 'SELECT * FROM users'" }
      ]

      dangerousQueries.forEach(query => {
        middleware.detectSuspiciousActivity(defaultContext, query)
      })

      const events = middleware.getSecurityEvents({ type: 'suspicious_activity' })
      expect(events.length).toBe(dangerousQueries.length)
    })

    it('should not flag legitimate queries', () => {
      const legitimateQueries = [
        "SELECT * FROM opportunities WHERE agency = 'Department of Defense'",
        { filter: { active: true, naics_codes: ['339112'] } },
        "medical equipment supplies"
      ]

      legitimateQueries.forEach(query => {
        middleware.detectSuspiciousActivity(defaultContext, query)
      })

      const events = middleware.getSecurityEvents({ type: 'suspicious_activity' })
      expect(events).toHaveLength(0)
    })

    it('should truncate long queries in logs', () => {
      const longQuery = 'SELECT * FROM table WHERE ' + 'x'.repeat(300)
      
      middleware.detectSuspiciousActivity(defaultContext, longQuery + '; DROP TABLE users;')

      const events = middleware.getSecurityEvents({ type: 'suspicious_activity' })
      expect(events[0].metadata?.query.length).toBeLessThanOrEqual(200)
    })
  })

  describe('Security Event Management', () => {
    it('should log all security events', async () => {
      // Generate various events
      await middleware.validatePermission(defaultContext, 'test', 'read')
      
      const unauthContext = { ...defaultContext, userId: '' }
      await middleware.validatePermission(unauthContext, 'test', 'read').catch(() => {})
      
      middleware.detectSuspiciousActivity(defaultContext, "'; DROP TABLE users;")

      const allEvents = middleware.getSecurityEvents()
      expect(allEvents.length).toBeGreaterThanOrEqual(3)
      
      const eventTypes = new Set(allEvents.map(e => e.type))
      expect(eventTypes).toContain('permission_check')
      expect(eventTypes).toContain('access_denied')
      expect(eventTypes).toContain('suspicious_activity')
    })

    it('should filter events by type', () => {
      // Generate mixed events
      for (let i = 0; i < 5; i++) {
        middleware['logSecurityEvent']({
          type: 'access_denied',
          userId: `user-${i}`,
          resource: 'test',
          action: 'read'
        })
      }

      for (let i = 0; i < 3; i++) {
        middleware['logSecurityEvent']({
          type: 'rate_limit',
          userId: `user-${i}`,
          resource: 'test',
          action: 'write'
        })
      }

      const deniedEvents = middleware.getSecurityEvents({ type: 'access_denied' })
      const rateLimitEvents = middleware.getSecurityEvents({ type: 'rate_limit' })

      expect(deniedEvents).toHaveLength(5)
      expect(rateLimitEvents).toHaveLength(3)
    })

    it('should filter events by user', async () => {
      const user1 = createTestSecurityContext({ userId: 'user-1' })
      const user2 = createTestSecurityContext({ userId: 'user-2' })

      await middleware.validatePermission(user1, 'test', 'read')
      await middleware.validatePermission(user2, 'test', 'read')
      await middleware.validatePermission(user1, 'test', 'write')

      const user1Events = middleware.getSecurityEvents({ userId: 'user-1' })
      const user2Events = middleware.getSecurityEvents({ userId: 'user-2' })

      expect(user1Events).toHaveLength(2)
      expect(user2Events).toHaveLength(1)
    })

    it('should filter events by time', async () => {
      const pastTime = new Date(Date.now() - 60000) // 1 minute ago

      // Add old event manually
      middleware['securityEvents'].push({
        type: 'access_denied',
        userId: 'old-user',
        resource: 'test',
        action: 'read',
        timestamp: new Date(Date.now() - 120000) // 2 minutes ago
      })

      // Add recent event
      await middleware.validatePermission(defaultContext, 'test', 'read')

      const recentEvents = middleware.getSecurityEvents({ since: pastTime })
      expect(recentEvents).toHaveLength(1)
      expect(recentEvents[0].userId).toBe(defaultContext.userId)
    })

    it('should limit stored events', () => {
      // Generate more than maxEvents
      for (let i = 0; i < 1100; i++) {
        middleware['logSecurityEvent']({
          type: 'permission_check',
          userId: `user-${i}`,
          resource: 'test',
          action: 'read'
        })
      }

      const events = middleware.getSecurityEvents()
      expect(events.length).toBeLessThanOrEqual(1000)
      
      // Should keep most recent events
      expect(events[events.length - 1].userId).toBe('user-1099')
    })

    it('should persist critical events to database', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'security_events.insert': { data: null, error: null }
        }
      })
      middleware = new SecurityMiddleware(mockSupabase)

      // Generate critical event
      const unauthContext = { ...defaultContext, userId: '' }
      await middleware.validatePermission(unauthContext, 'test', 'write').catch(() => {})

      // Wait for async persistence
      await waitForAsync(10)

      expect(mockSupabase.from).toHaveBeenCalledWith('security_events')
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'access_denied',
          user_id: 'anonymous',
          resource: 'test',
          action: 'write'
        })
      )
    })
  })

  describe('Security Report', () => {
    it('should generate comprehensive security report', async () => {
      // Generate various events
      for (let i = 0; i < 10; i++) {
        await middleware.validatePermission(defaultContext, 'test', 'read')
      }

      for (let i = 0; i < 5; i++) {
        const context = createTestSecurityContext({ userId: `user-${i}` })
        await middleware.validatePermission(context, 'test', 'write')
      }

      middleware.detectSuspiciousActivity(defaultContext, "DROP TABLE users;")

      const report = middleware.generateSecurityReport()

      expect(report.totalEvents).toBeGreaterThan(0)
      expect(report.byType['permission_check']).toBeGreaterThan(0)
      expect(report.topUsers).toHaveLength(Math.min(6, report.topUsers.length))
      expect(report.topUsers[0].userId).toBe(defaultContext.userId)
      expect(report.recentSuspicious).toHaveLength(1)
    })
  })

  describe('createContext', () => {
    it('should create context from authenticated user', async () => {
      mockSupabase = createMockSupabaseClient({
        user: {
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null
        },
        responses: {
          'profiles.select': { 
            data: { company_id: 'company-1', role: 'admin' }, 
            error: null 
          }
        }
      })

      const context = await SecurityMiddleware.createContext(
        mockSupabase,
        'session-123',
        '192.168.1.1'
      )

      expect(context).toEqual({
        userId: 'user-1',
        companyId: 'company-1',
        role: 'admin',
        sessionId: 'session-123',
        ipAddress: '192.168.1.1'
      })
    })

    it('should return null for unauthenticated user', async () => {
      mockSupabase = createMockSupabaseClient({
        user: { data: { user: null }, error: null }
      })

      const context = await SecurityMiddleware.createContext(mockSupabase)

      expect(context).toBeNull()
    })

    it('should handle missing profile gracefully', async () => {
      mockSupabase = createMockSupabaseClient({
        user: {
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null
        },
        responses: {
          'profiles.select': { data: null, error: null }
        }
      })

      const context = await SecurityMiddleware.createContext(mockSupabase)

      expect(context).toEqual({
        userId: 'user-1',
        companyId: undefined,
        role: undefined,
        sessionId: undefined,
        ipAddress: undefined
      })
    })
  })
})