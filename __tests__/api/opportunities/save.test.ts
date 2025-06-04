/**
 * Tests for Save Opportunities API
 * POST /api/opportunities/save
 */

import { POST } from '@/app/api/opportunities/save/route'
import { createMockNextRequest, mockUser, extractResponseJson } from '../../utils/api-test-utils'
import { mockSupabaseClient, configureMockSupabase } from '../../mocks/supabase'

describe('/api/opportunities/save', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default auth success
    configureMockSupabase({
      auth: { user: mockUser }
    })
  })

  describe('Authentication', () => {
    it('should require authentication', async () => {
      configureMockSupabase({
        auth: { user: null, error: { message: 'Not authenticated' } }
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
    })

    it('should require action', async () => {
      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'opp-123' } // Missing action
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should validate action values', async () => {
      // Mock opportunity exists
      const fromMock = mockSupabaseClient.from('opportunities')
      fromMock.single.mockResolvedValueOnce({
        data: { id: 'opp-123' },
        error: null
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'opp-123', action: 'invalid' }
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should verify opportunity exists', async () => {
      // Mock opportunity not found
      const fromMock = mockSupabaseClient.from('opportunities')
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'invalid-id', action: 'save' }
      })

      const response = await POST(request)
      expect(response.status).toBe(404)
      
      const data = await extractResponseJson(response)
      expect(data.error).toContain('not found')
    })
  })

  describe('Save action', () => {
    beforeEach(() => {
      // Mock opportunity exists
      const oppMock = mockSupabaseClient.from('opportunities')
      oppMock.single.mockResolvedValue({
        data: { id: 'opp-123' },
        error: null
      })
    })

    it('should save new opportunity successfully', async () => {
      // Mock saved opportunities check (not already saved)
      const savedMock = mockSupabaseClient.from('saved_opportunities')
      savedMock.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      // Mock insert success
      savedMock.insert = jest.fn().mockReturnThis()
      savedMock.then = jest.fn().mockResolvedValueOnce({
        data: { id: 'saved-123' },
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

      expect(savedMock.insert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        opportunity_id: 'opp-123',
        notes: 'This looks promising',
        tags: ['medical', 'priority'],
        is_pursuing: true,
        reminder_date: '2024-12-15T10:00:00Z'
      })
    })

    it('should update existing saved opportunity', async () => {
      // Mock saved opportunities check (already saved)
      const savedMock = mockSupabaseClient.from('saved_opportunities')
      savedMock.single.mockResolvedValueOnce({
        data: { id: 'saved-123' },
        error: null
      })

      // Mock update success
      savedMock.update = jest.fn().mockReturnThis()
      savedMock.eq = jest.fn().mockReturnThis()
      savedMock.then = jest.fn().mockResolvedValueOnce({
        data: { id: 'saved-123' },
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

      expect(savedMock.update).toHaveBeenCalledWith({
        notes: 'Updated notes',
        tags: [],
        is_pursuing: false,
        reminder_date: null,
        updated_at: expect.any(String)
      })
    })
  })

  describe('Unsave action', () => {
    beforeEach(() => {
      // Mock opportunity exists
      const oppMock = mockSupabaseClient.from('opportunities')
      oppMock.single.mockResolvedValue({
        data: { id: 'opp-123' },
        error: null
      })
    })

    it('should unsave opportunity successfully', async () => {
      const savedMock = mockSupabaseClient.from('saved_opportunities')
      
      // Mock delete chain
      savedMock.delete = jest.fn().mockReturnThis()
      savedMock.eq = jest.fn().mockReturnThis()
      savedMock.then = jest.fn().mockResolvedValueOnce({
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

      expect(savedMock.delete).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      // Mock opportunity exists
      const oppMock = mockSupabaseClient.from('opportunities')
      oppMock.single.mockResolvedValue({
        data: { id: 'opp-123' },
        error: null
      })
    })

    it('should handle database errors during save', async () => {
      // Mock saved opportunities check
      const savedMock = mockSupabaseClient.from('saved_opportunities')
      savedMock.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      // Mock insert error
      savedMock.insert = jest.fn().mockReturnThis()
      savedMock.then = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' }
      })

      const request = createMockNextRequest('https://example.com/api/opportunities/save', {
        method: 'POST',
        body: { opportunityId: 'opp-123', action: 'save' }
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toContain('Database error')
    })
  })
})