/**
 * Tests for Sync Status API
 * GET /api/sync/status
 */

import { GET } from '@/app/api/sync/status/route'
import { createMockNextRequest, mockUser, extractResponseJson } from '../../utils/api-test-utils'

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn()
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createServerComponentClient: jest.fn(() => mockSupabaseClient)
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

describe('/api/sync/status', () => {
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

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)
      
      expect(response.status).toBe(401)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Successful sync status', () => {
    it('should return success status with recent sync', async () => {
      const lastSyncDate = '2024-12-01T10:00:00Z'
      const syncStats = {
        fetched: 100,
        inserted: 15,
        updated: 5,
        errors: 0
      }

      mockSupabaseClient.from
        // Last sync log
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{
              id: 'log-123',
              created_at: lastSyncDate,
              action: 'automated_sync',
              changes: syncStats
            }],
            error: null
          })
        })
        // Last failure log (none)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        // Total opportunities count
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({
            count: 5432,
            error: null
          })
        })
        // Recent opportunities count
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({
            count: 89,
            error: null
          })
        })
        // Running sync check (none)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        status: 'success',
        lastSync: lastSyncDate,
        nextSync: expect.any(String),
        lastSyncStats: syncStats,
        lastError: null,
        totalOpportunities: 5432,
        recentOpportunities: 89,
        syncInterval: '6 hours'
      })

      // Verify next sync is 6 hours after last sync
      const nextSyncTime = new Date(data.nextSync).getTime()
      const expectedNextSync = new Date(lastSyncDate).getTime() + (6 * 60 * 60 * 1000)
      expect(nextSyncTime).toBe(expectedNextSync)
    })

    it('should return failed status when recent failure exists', async () => {
      const lastSyncDate = '2024-12-01T08:00:00Z'
      const lastFailureDate = '2024-12-01T10:00:00Z'
      const errorMessage = 'SAM.gov API timeout'

      mockSupabaseClient.from
        // Last sync log
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{
              id: 'log-123',
              created_at: lastSyncDate,
              action: 'automated_sync',
              changes: { fetched: 50, inserted: 5, updated: 2 }
            }],
            error: null
          })
        })
        // Last failure log (more recent than sync)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{
              id: 'log-456',
              created_at: lastFailureDate,
              action: 'sync_failed',
              changes: { error: errorMessage }
            }],
            error: null
          })
        })
        // Total opportunities count
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({
            count: 5432,
            error: null
          })
        })
        // Recent opportunities count
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({
            count: 12,
            error: null
          })
        })
        // Running sync check
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        status: 'failed',
        lastSync: lastSyncDate,
        lastError: errorMessage,
        totalOpportunities: 5432,
        recentOpportunities: 12
      })
    })

    it('should return running status when sync is currently active', async () => {
      const runningSyncDate = new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 minutes ago

      mockSupabaseClient.from
        // Last sync log
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        // Last failure log
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        // Total opportunities count
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({
            count: 5432,
            error: null
          })
        })
        // Recent opportunities count
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({
            count: 45,
            error: null
          })
        })
        // Running sync check (found running sync)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{
              id: 'log-running',
              created_at: runningSyncDate,
              action: 'sync_started'
            }],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data.status).toBe('running')
    })

    it('should return unknown status when no sync history exists', async () => {
      mockSupabaseClient.from
        // No sync logs
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        // No failure logs
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        // Total opportunities count
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({
            count: 0,
            error: null
          })
        })
        // Recent opportunities count
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({
            count: 0,
            error: null
          })
        })
        // No running sync
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        status: 'unknown',
        lastSync: null,
        lastSyncStats: null,
        lastError: null,
        totalOpportunities: 0,
        recentOpportunities: 0,
        nextSync: expect.any(String) // Should default to 1 hour from now
      })
    })

    it('should handle failed status from failure log only', async () => {
      const failureDate = '2024-12-01T10:00:00Z'
      const errorMessage = 'Database connection failed'

      mockSupabaseClient.from
        // No successful sync logs
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        // Has failure log
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{
              id: 'log-456',
              created_at: failureDate,
              action: 'sync_failed',
              changes: { error: errorMessage }
            }],
            error: null
          })
        })
        // Total opportunities count
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({
            count: 1000,
            error: null
          })
        })
        // Recent opportunities count
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({
            count: 25,
            error: null
          })
        })
        // No running sync
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        status: 'failed',
        lastSync: null,
        lastSyncStats: null,
        lastError: errorMessage
      })
    })
  })

  describe('Database queries', () => {
    it('should query correct tables and filters', async () => {
      // Set up default mocks for all queries
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      }

      const mockCountQuery = {
        select: jest.fn().mockResolvedValue({ count: 0, error: null })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce(mockQuery) // Last sync log
        .mockReturnValueOnce(mockQuery) // Last failure log
        .mockReturnValueOnce(mockCountQuery) // Total opportunities
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ count: 0, error: null })
        }) // Recent opportunities
        .mockReturnValueOnce(mockQuery) // Running sync check

      const request = createMockNextRequest('https://example.com/api/sync/status')
      await GET(request)

      // Verify audit_logs table queries
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('audit_logs')
      
      // Verify opportunities table queries
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('opportunities')

      // Verify sync action filters
      expect(mockQuery.in).toHaveBeenCalledWith('action', ['automated_sync', 'manual_sync'])
      expect(mockQuery.eq).toHaveBeenCalledWith('action', 'sync_failed')
      expect(mockQuery.eq).toHaveBeenCalledWith('action', 'sync_started')

      // Verify system user filter (null user_id)
      expect(mockQuery.is).toHaveBeenCalledWith('user_id', null)
    })

    it('should calculate recent opportunities date filter correctly', async () => {
      const mockRecentQuery = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ count: 0, error: null })
      }

      // Set up other mocks
      const defaultMock = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce(defaultMock)
        .mockReturnValueOnce(defaultMock)
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({ count: 0, error: null })
        })
        .mockReturnValueOnce(mockRecentQuery) // Recent opportunities query
        .mockReturnValueOnce(defaultMock)

      const request = createMockNextRequest('https://example.com/api/sync/status')
      await GET(request)

      // Should filter by date from 7 days ago
      expect(mockRecentQuery.gte).toHaveBeenCalledWith('created_at', expect.any(String))
      
      // Verify the date is approximately 7 days ago
      const dateArg = mockRecentQuery.gte.mock.calls[0][1]
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const argDate = new Date(dateArg)
      const timeDiff = Math.abs(argDate.getTime() - sevenDaysAgo.getTime())
      expect(timeDiff).toBeLessThan(60000) // Within 1 minute tolerance
    })
  })

  describe('Error handling', () => {
    it('should handle database query errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Database error'))
      })

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)

      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Failed to get sync status')
      expect(data.details).toBe('Database error')
    })

    it('should handle null count responses', async () => {
      const defaultMock = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce(defaultMock)
        .mockReturnValueOnce(defaultMock)
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({ count: null, error: null })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ count: null, error: null })
        })
        .mockReturnValueOnce(defaultMock)

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data.totalOpportunities).toBe(0)
      expect(data.recentOpportunities).toBe(0)
    })

    it('should handle malformed audit log data', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{
              id: 'log-123',
              created_at: '2024-12-01T10:00:00Z',
              action: 'automated_sync',
              changes: null // Malformed changes
            }],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{
              id: 'log-456',
              created_at: '2024-12-01T11:00:00Z',
              action: 'sync_failed',
              changes: { /* missing error field */ }
            }],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({ count: 100, error: null })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ count: 10, error: null })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data.lastSyncStats).toBe(null)
      expect(data.lastError).toBe('Unknown error')
    })
  })

  describe('Next sync calculation', () => {
    it('should calculate next sync correctly when last sync exists', async () => {
      const lastSyncDate = '2024-12-01T10:00:00Z'
      const expectedNextSync = new Date(new Date(lastSyncDate).getTime() + 6 * 60 * 60 * 1000)

      const defaultMock = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{
              created_at: lastSyncDate,
              changes: {}
            }],
            error: null
          })
        })
        .mockReturnValueOnce(defaultMock)
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({ count: 100, error: null })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ count: 10, error: null })
        })
        .mockReturnValueOnce(defaultMock)

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.nextSync).toBe(expectedNextSync.toISOString())
    })

    it('should default next sync to 1 hour when no last sync', async () => {
      const defaultMock = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      }

      mockSupabaseClient.from
        .mockReturnValue(defaultMock)
        .mockReturnValueOnce(defaultMock)
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({ count: 0, error: null })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ count: 0, error: null })
        })

      const request = createMockNextRequest('https://example.com/api/sync/status')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      const nextSyncTime = new Date(data.nextSync).getTime()
      const expectedTime = Date.now() + 60 * 60 * 1000 // 1 hour from now
      const timeDiff = Math.abs(nextSyncTime - expectedTime)
      expect(timeDiff).toBeLessThan(5000) // Within 5 seconds tolerance
    })
  })
})