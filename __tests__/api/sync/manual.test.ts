/**
 * Tests for Manual Sync API
 * POST /api/sync/manual
 */

import { POST } from '@/app/api/sync/manual/route'
import { createMockNextRequest, mockUser, extractResponseJson } from '../../utils/api-test-utils'

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

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn()
  },
  rpc: jest.fn()
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createServerComponentClient: jest.fn(() => mockSupabaseClient)
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

describe('/api/sync/manual', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default auth success
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    // Default successful sync result
    mockSyncOpportunitiesToDatabase.mockResolvedValue({
      inserted: 3,
      updated: 2,
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
    mockSupabaseClient.rpc.mockResolvedValue({
      data: null,
      error: null
    })
  })

  describe('Authentication', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })

      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 50 }
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Successful manual sync', () => {
    it('should trigger manual sync successfully with default parameters', async () => {
      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 50 }
      })

      const response = await POST(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        message: 'Manual sync completed: 3 new, 2 updated',
        stats: {
          fetched: 3,
          inserted: 3,
          updated: 2,
          errors: []
        }
      })

      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          active: 'true',
          limit: 50,
          offset: 0,
          postedFrom: expect.any(String) // Should include 3-day filter
        })
      )

      expect(mockSyncOpportunitiesToDatabase).toHaveBeenCalledWith([
        { id: 'opp-1', title: 'Test Opportunity 1' },
        { id: 'opp-2', title: 'Test Opportunity 2' },
        { id: 'opp-3', title: 'Test Opportunity 3' }
      ])
    })

    it('should handle custom limit parameter', async () => {
      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 25 }
      })

      await POST(request)

      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25
        })
      )
    })

    it('should handle NAICS filter parameter', async () => {
      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { 
          limit: 50,
          naicsFilter: '334510'
        }
      })

      await POST(request)

      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          naicsCode: '334510'
        })
      )
    })

    it('should enforce maximum limit', async () => {
      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 500 } // Above max of 100
      })

      await POST(request)

      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100 // Should be capped at 100
        })
      )
    })

    it('should use default limit when not specified', async () => {
      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: {}
      })

      await POST(request)

      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50 // Default value
        })
      )
    })

    it('should log sync start and completion', async () => {
      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { 
          limit: 30,
          naicsFilter: '621999'
        }
      })

      await POST(request)

      // Should log sync start
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('log_audit', {
        p_action: 'manual_sync_started',
        p_entity_type: 'opportunities',
        p_changes: {
          limit: 30,
          naicsFilter: '621999',
          triggered_by: mockUser.id
        }
      })

      // Should log sync completion
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('log_audit', {
        p_action: 'manual_sync',
        p_entity_type: 'opportunities',
        p_changes: {
          fetched: 3,
          inserted: 3,
          updated: 2,
          errors: 0,
          triggered_by: mockUser.id,
          naics_filter: '621999'
        }
      })
    })
  })

  describe('No opportunities scenarios', () => {
    it('should handle empty SAM.gov response gracefully', async () => {
      mockGetOpportunities.mockResolvedValue({
        opportunitiesData: []
      })

      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 50 }
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

      // Should log no opportunities found
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('log_audit', {
        p_action: 'manual_sync',
        p_entity_type: 'opportunities',
        p_changes: {
          fetched: 0,
          inserted: 0,
          updated: 0,
          triggered_by: mockUser.id,
          message: 'No new opportunities found'
        }
      })
    })

    it('should handle null opportunitiesData', async () => {
      mockGetOpportunities.mockResolvedValue({
        opportunitiesData: null
      })

      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 50 }
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

      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 50 }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Manual sync failed')
      expect(data.details).toBe('SAM.gov API unavailable')
    })

    it('should handle database sync errors', async () => {
      mockSyncOpportunitiesToDatabase.mockRejectedValue(new Error('Database connection failed'))

      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 50 }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Manual sync failed')
      expect(data.details).toBe('Database connection failed')
    })

    it('should log manual sync failures', async () => {
      mockGetOpportunities.mockRejectedValue(new Error('API Error'))

      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 50 }
      })

      await POST(request)

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('log_audit', {
        p_action: 'manual_sync_failed',
        p_entity_type: 'opportunities',
        p_changes: {
          error: 'API Error',
          triggered_by: mockUser.id
        }
      })
    })

    it('should handle audit log failures during error logging', async () => {
      mockGetOpportunities.mockRejectedValue(new Error('API Error'))
      
      // Mock the error creation of new Supabase client for error logging
      const mockErrorSupabaseClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null
          })
        },
        rpc: jest.fn().mockRejectedValue(new Error('Log error failed'))
      }

      // Override the mock for error logging scenario
      require('@supabase/auth-helpers-nextjs').createServerComponentClient
        .mockReturnValueOnce(mockSupabaseClient) // For main request
        .mockReturnValueOnce(mockErrorSupabaseClient) // For error logging

      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 50 }
      })

      const response = await POST(request)
      
      // Should still return the original error even if logging fails
      expect(response.status).toBe(500)
      const data = await extractResponseJson(response)
      expect(data.details).toBe('API Error')
    })

    it('should handle JSON parsing errors', async () => {
      // Create a request with invalid JSON
      const request = new Request('https://example.com/api/sync/manual', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: 'invalid json {'
      })

      const response = await POST(request as any)
      expect(response.status).toBe(500)
    })
  })

  describe('Parameter validation', () => {
    it('should handle non-numeric limit gracefully', async () => {
      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 'invalid' }
      })

      const response = await POST(request)
      
      // Should use default limit
      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50 // Default when invalid
        })
      )
    })

    it('should handle missing request body', async () => {
      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST'
        // No body
      })

      const response = await POST(request)
      expect(response.status).toBe(200) // Should still work with defaults
    })
  })

  describe('Date filtering', () => {
    it('should filter opportunities from last 3 days', async () => {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const expectedDate = threeDaysAgo.toISOString().split('T')[0]

      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 50 }
      })

      await POST(request)

      expect(mockGetOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          postedFrom: expectedDate
        })
      )
    })
  })

  describe('Sync with partial errors', () => {
    it('should handle sync result with errors', async () => {
      mockSyncOpportunitiesToDatabase.mockResolvedValue({
        inserted: 1,
        updated: 1,
        errors: [
          'Failed to insert opportunity opp-3: Invalid data'
        ]
      })

      const request = createMockNextRequest('https://example.com/api/sync/manual', {
        method: 'POST',
        body: { limit: 50 }
      })

      const response = await POST(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data.stats.errors).toEqual([
        'Failed to insert opportunity opp-3: Invalid data'
      ])

      // Should log the error count
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('log_audit', {
        p_action: 'manual_sync',
        p_entity_type: 'opportunities',
        p_changes: expect.objectContaining({
          errors: 1
        })
      })
    })
  })
})