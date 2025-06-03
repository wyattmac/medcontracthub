/**
 * Tests for Save Opportunities API
 * POST /api/opportunities/save
 */

import { POST } from '@/app/api/opportunities/save/route'
import { createMockNextRequest, mockUser, mockOpportunity, extractResponseJson } from '../../utils/api-test-utils'

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(),
  rpc: jest.fn()
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createServerComponentClient: jest.fn(() => mockSupabaseClient)
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

describe('/api/opportunities/save', () => {
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

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'opp-123', action: 'save' }
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })
  })

  describe('Validation', () => {
    it('should require opportunityId', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { action: 'save' } // Missing opportunityId
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Missing required fields')
    })

    it('should require action', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'opp-123' } // Missing action
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Missing required fields')
    })

    it('should validate action values', async () => {
      // Mock opportunity exists
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'opp-123' },
          error: null
        })
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'opp-123', action: 'invalid' }
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Invalid action')
    })

    it('should verify opportunity exists', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'invalid-id', action: 'save' }
      })

      const response = await POST(request)
      expect(response.status).toBe(404)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Opportunity not found')
    })
  })

  describe('Save action', () => {
    beforeEach(() => {
      // Mock opportunity exists
      const mockOpportunityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'opp-123' },
          error: null
        })
      }
      
      mockSupabaseClient.from.mockReturnValue(mockOpportunityQuery)
    })

    it('should save new opportunity successfully', async () => {
      const mockSavedOpportunityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null, // Not already saved
          error: null
        }),
        insert: jest.fn().mockResolvedValue({
          data: { id: 'saved-123' },
          error: null
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'opp-123' },
            error: null
          })
        })
        .mockReturnValueOnce(mockSavedOpportunityQuery)

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: {
          opportunityId: 'opp-123',
          action: 'save',
          notes: 'This looks promising',
          tags: ['medical', 'priority'],
          isPursuing: true,
          reminderDate: '2024-12-15T10:00:00Z'
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      
      const data = await extractResponseJson(response)
      expect(data).toEqual({
        success: true,
        message: 'Opportunity saved successfully'
      })

      expect(mockSavedOpportunityQuery.insert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        opportunity_id: 'opp-123',
        notes: 'This looks promising',
        tags: ['medical', 'priority'],
        is_pursuing: true,
        reminder_date: '2024-12-15T10:00:00Z'
      })
    })

    it('should update existing saved opportunity', async () => {
      const mockSavedOpportunityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'saved-123' }, // Already saved
          error: null
        }),
        update: jest.fn().mockReturnThis()
      }

      mockSavedOpportunityQuery.update.mockResolvedValue({
        data: { id: 'saved-123' },
        error: null
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'opp-123' },
            error: null
          })
        })
        .mockReturnValueOnce(mockSavedOpportunityQuery)

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: {
          opportunityId: 'opp-123',
          action: 'save',
          notes: 'Updated notes'
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      expect(mockSavedOpportunityQuery.update).toHaveBeenCalledWith({
        notes: 'Updated notes',
        tags: [],
        is_pursuing: false,
        reminder_date: null,
        updated_at: expect.any(String)
      })
    })

    it('should handle save with default values', async () => {
      const mockSavedOpportunityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        }),
        insert: jest.fn().mockResolvedValue({
          data: { id: 'saved-123' },
          error: null
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'opp-123' },
            error: null
          })
        })
        .mockReturnValueOnce(mockSavedOpportunityQuery)

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: {
          opportunityId: 'opp-123',
          action: 'save'
          // No additional fields
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      expect(mockSavedOpportunityQuery.insert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        opportunity_id: 'opp-123',
        notes: null,
        tags: [],
        is_pursuing: false,
        reminder_date: null
      })
    })

    it('should log save action', async () => {
      const mockSavedOpportunityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({ data: { id: 'saved-123' }, error: null })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'opp-123' }, error: null })
        })
        .mockReturnValueOnce(mockSavedOpportunityQuery)

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: {
          opportunityId: 'opp-123',
          action: 'save',
          notes: 'Test notes',
          tags: ['tag1', 'tag2']
        }
      })

      await POST(request)

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('log_audit', {
        p_action: 'save_opportunity',
        p_entity_type: 'opportunities',
        p_entity_id: 'opp-123',
        p_changes: { action: 'save', notes: true, tags: 2 }
      })
    })
  })

  describe('Unsave action', () => {
    beforeEach(() => {
      // Mock opportunity exists
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'opp-123' },
          error: null
        })
      })
    })

    it('should unsave opportunity successfully', async () => {
      const mockDeleteQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      }

      mockDeleteQuery.eq.mockResolvedValue({
        data: null,
        error: null
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'opp-123' },
            error: null
          })
        })
        .mockReturnValueOnce(mockDeleteQuery)

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: {
          opportunityId: 'opp-123',
          action: 'unsave'
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      
      const data = await extractResponseJson(response)
      expect(data).toEqual({
        success: true,
        message: 'Opportunity unsaved successfully'
      })

      expect(mockDeleteQuery.delete).toHaveBeenCalled()
      expect(mockDeleteQuery.eq).toHaveBeenCalledWith('user_id', mockUser.id)
      expect(mockDeleteQuery.eq).toHaveBeenCalledWith('opportunity_id', 'opp-123')
    })

    it('should log unsave action', async () => {
      const mockDeleteQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      }

      mockDeleteQuery.eq.mockResolvedValue({ data: null, error: null })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'opp-123' }, error: null })
        })
        .mockReturnValueOnce(mockDeleteQuery)

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'opp-123', action: 'unsave' }
      })

      await POST(request)

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('log_audit', {
        p_action: 'unsave_opportunity',
        p_entity_type: 'opportunities',
        p_entity_id: 'opp-123',
        p_changes: { action: 'unsave' }
      })
    })
  })

  describe('Error handling', () => {
    it('should handle database errors during save', async () => {
      const mockSavedOpportunityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'opp-123' }, error: null })
        })
        .mockReturnValueOnce(mockSavedOpportunityQuery)

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'opp-123', action: 'save' }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Failed to save opportunity')
    })

    it('should handle database errors during unsave', async () => {
      const mockDeleteQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      }

      mockDeleteQuery.eq.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'opp-123' }, error: null })
        })
        .mockReturnValueOnce(mockDeleteQuery)

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'opp-123', action: 'unsave' }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Failed to unsave opportunity')
    })

    it('should handle unexpected errors', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'opp-123', action: 'save' }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Internal server error')
      expect(data.details).toBe('Unexpected error')
    })
  })
})