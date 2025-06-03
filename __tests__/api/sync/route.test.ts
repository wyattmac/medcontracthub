/**
 * Tests for Automated Sync API
 * POST /api/sync
 */

import { POST } from '@/app/api/sync/route'
import { createMockNextRequest, extractResponseJson } from '../../utils/api-test-utils'

// Mock SAM.gov client
const mockGetOpportunities = jest.fn()
jest.mock('@/lib/sam-gov', () => ({
  samApiClient: {
    getOpportunities: mockGetOpportunities
  }
}))

// Mock sync utilities
const mockSyncOpportunitiesToDatabase = jest.fn()
jest.mock('@/lib/sam-gov/utils', () => ({
  syncOpportunitiesToDatabase: mockSyncOpportunitiesToDatabase
}))

// Mock Supabase with service role
const mockSupabaseServiceClient = {
  from: jest.fn()
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseServiceClient)
}))

// Mock environment variables
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    SYNC_TOKEN: 'test-sync-token'
  }
})

afterAll(() => {
  process.env = originalEnv
})

describe('/api/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default successful sync result
    mockSyncOpportunitiesToDatabase.mockResolvedValue({
      inserted: 5,
      updated: 3,
      errors: []
    })

    // Default successful SAM.gov response
    mockGetOpportunities.mockResolvedValue({
      opportunitiesData: [
        { id: 'opp-1', title: 'Test Opportunity 1' },
        { id: 'opp-2', title: 'Test Opportunity 2' },
        { id: 'opp-3', title: 'Test Opportunity 3' }
      ]
    })

    // Default successful audit log
    mockSupabaseServiceClient.from.mockReturnValue({
      insert: jest.fn().mockResolvedValue({
        data: { id: 'log-123' },
        error: null
      })
    })
  })

  describe('Authentication', () => {
    it('should require authorization token', async () => {
      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST'
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Unauthorized')
    })

    it('should accept valid authorization token', async () => {
      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('should reject invalid authorization token', async () => {
      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer invalid-token'
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })
  })

  describe('Successful sync operations', () => {
    beforeEach(() => {
      // Mock valid authorization
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-12-01T10:00:00Z')
    })

    it('should sync opportunities successfully with default parameters', async () => {
      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      const response = await POST(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        message: 'Sync completed: 5 new, 3 updated',
        stats: {
          fetched: 3,
          inserted: 5,
          updated: 3,
          errors: []
        }
      })

      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          active: 'true',
          limit: 100,
          offset: 0,
          postedFrom: expect.any(String)
        })
      )

      expect(mockSyncOpportunitiesToDatabase).toHaveBeenCalledWith([
        { id: 'opp-1', title: 'Test Opportunity 1' },
        { id: 'opp-2', title: 'Test Opportunity 2' },
        { id: 'opp-3', title: 'Test Opportunity 3' }
      ])
    })

    it('should handle force sync parameter', async () => {
      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        },
        searchParams: {
          force: 'true'
        }
      })

      await POST(request)

      // Should not include postedFrom parameter when force sync
      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          active: 'true',
          limit: 100,
          offset: 0
        })
      )
      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.not.objectContaining({
          postedFrom: expect.any(String)
        })
      )
    })

    it('should handle NAICS filter parameter', async () => {
      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        },
        searchParams: {
          naics: '334510'
        }
      })

      await POST(request)

      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          naicsCode: '334510'
        })
      )
    })

    it('should handle custom limit parameter', async () => {
      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        },
        searchParams: {
          limit: '50'
        }
      })

      await POST(request)

      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50
        })
      )
    })

    it('should handle paginated results', async () => {
      // First page
      mockGetOpportunities
        .mockResolvedValueOnce({
          opportunitiesData: new Array(100).fill(null).map((_, i) => ({
            id: `opp-${i}`,
            title: `Opportunity ${i}`
          }))
        })
        // Second page with fewer results
        .mockResolvedValueOnce({
          opportunitiesData: [
            { id: 'opp-100', title: 'Opportunity 100' },
            { id: 'opp-101', title: 'Opportunity 101' }
          ]
        })

      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      const response = await POST(request)
      const data = await extractResponseJson(response)

      expect(data.stats.fetched).toBe(102)
      expect(mockGetOpportunities).toHaveBeenCalledTimes(2)
      
      // Check pagination parameters
      expect(mockGetOpportunities).toHaveBeenNthCalledWith(1, expect.objectContaining({ offset: 0 }))
      expect(mockGetOpportunities).toHaveBeenNthCalledWith(2, expect.objectContaining({ offset: 100 }))
    })

    it('should log sync activity to audit logs', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: { id: 'log-123' },
        error: null
      })

      mockSupabaseServiceClient.from.mockReturnValue({
        insert: mockInsert
      })

      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        },
        searchParams: {
          naics: '334510',
          force: 'true'
        }
      })

      await POST(request)

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: null,
        action: 'automated_sync',
        entity_type: 'opportunities',
        changes: {
          fetched: 3,
          inserted: 5,
          updated: 3,
          errors: 0,
          naics_filter: '334510',
          force_sync: true
        }
      })
    })
  })

  describe('No opportunities scenarios', () => {
    it('should handle empty SAM.gov response gracefully', async () => {
      mockGetOpportunities.mockResolvedValue({
        opportunitiesData: []
      })

      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      const response = await POST(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        message: 'No new opportunities found',
        stats: {
          fetched: 0,
          inserted: 0,
          updated: 0,
          errors: []
        }
      })

      expect(mockSyncOpportunitiesToDatabase).not.toHaveBeenCalled()
    })

    it('should handle null opportunitiesData', async () => {
      mockGetOpportunities.mockResolvedValue({
        opportunitiesData: null
      })

      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      const response = await POST(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data.message).toBe('No new opportunities found')
    })
  })

  describe('Error handling', () => {
    it('should handle SAM.gov API errors', async () => {
      mockGetOpportunities.mockRejectedValue(new Error('SAM.gov API unavailable'))

      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Sync failed')
      expect(data.details).toBe('SAM.gov API unavailable')
    })

    it('should handle database sync errors', async () => {
      mockSyncOpportunitiesToDatabase.mockRejectedValue(new Error('Database connection failed'))

      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Sync failed')
      expect(data.details).toBe('Database connection failed')
    })

    it('should handle sync operation timeout', async () => {
      // Mock a long-running operation
      mockGetOpportunities.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      )

      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.details).toContain('timeout')
    }, 10000) // Increase test timeout

    it('should log sync failures', async () => {
      mockGetOpportunities.mockRejectedValue(new Error('API Error'))
      
      const mockInsert = jest.fn().mockResolvedValue({
        data: { id: 'log-123' },
        error: null
      })

      mockSupabaseServiceClient.from.mockReturnValue({
        insert: mockInsert
      })

      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      await POST(request)

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: null,
        action: 'sync_failed',
        entity_type: 'opportunities',
        changes: {
          error: 'API Error'
        }
      })
    })

    it('should handle audit log failures gracefully', async () => {
      mockSupabaseServiceClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Log insert failed' }
        })
      })

      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      const response = await POST(request)
      
      // Should still complete sync successfully even if logging fails
      expect(response.status).toBe(200)
    })
  })

  describe('Sync with errors in data', () => {
    it('should handle partial sync success with errors', async () => {
      mockSyncOpportunitiesToDatabase.mockResolvedValue({
        inserted: 2,
        updated: 1,
        errors: [
          'Failed to insert opportunity opp-3: Invalid data',
          'Failed to update opportunity opp-4: Constraint violation'
        ]
      })

      const request = createMockNextRequest('https://example.com/api/sync', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-sync-token'
        }
      })

      const response = await POST(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        message: 'Sync completed: 2 new, 1 updated',
        stats: {
          fetched: 3,
          inserted: 2,
          updated: 1,
          errors: [
            'Failed to insert opportunity opp-3: Invalid data',
            'Failed to update opportunity opp-4: Constraint violation'
          ]
        }
      })
    })
  })
})