/**
 * API Route Test: /api/opportunities/save
 * Tests for saving/unsaving opportunities functionality
 */

import { POST } from '@/app/api/opportunities/save/route'
import {
  setupApiTest,
  assertApiResponse,
  assertApiError,
  testAuthentication,
  testValidation
} from '../../utils/api-test-helper'

describe('/api/opportunities/save', () => {
  describe('Authentication', () => {
    it('should require authentication', async () => {
      await testAuthentication(POST, '/api/opportunities/save', 'POST')
    })
  })

  describe('Request Validation', () => {
    it('should require opportunity_id', async () => {
      await testValidation(
        POST,
        '/api/opportunities/save',
        {}, // Missing opportunity_id
        'POST'
      )
    })

    it('should validate opportunity_id format', async () => {
      await testValidation(
        POST,
        '/api/opportunities/save',
        { opportunity_id: '' }, // Empty string
        'POST'
      )
    })

    it('should accept valid save request', async () => {
      const context = await setupApiTest('POST', '/api/opportunities/save', {
        user: { id: 'test-user' },
        body: {
          opportunity_id: 'test-opp-123'
        },
        headers: {
          'x-csrf-token': 'valid-token'
        },
        mockData: {
          insert: { id: 'save-123' }
        }
      })

      const response = await POST(context.request)
      
      await assertApiResponse(response, 200, {
        saved: true,
        message: expect.any(String)
      })

      await context.cleanup()
    })
  })

  describe('Save/Unsave Logic', () => {
    it('should save opportunity when not already saved', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null, // Not found - not saved
                  error: { code: 'PGRST116' } // Supabase "not found" error
                })
              })
            })
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'save-123' }],
              error: null
            })
          })
        })
      }

      const context = await setupApiTest('POST', '/api/opportunities/save', {
        user: { id: 'test-user' },
        body: {
          opportunity_id: 'test-opp-123'
        },
        headers: {
          'x-csrf-token': 'valid-token'
        }
      })

      // Override mock
      context.mockSupabase = mockSupabase as any

      const response = await POST(context.request)
      const data = await response.json()
      
      expect(data.saved).toBe(true)
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        user_id: 'test-user',
        opportunity_id: 'test-opp-123'
      })

      await context.cleanup()
    })

    it('should unsave opportunity when already saved', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'save-123' }, // Found - already saved
                  error: null
                })
              })
            })
          }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
      }

      const context = await setupApiTest('POST', '/api/opportunities/save', {
        user: { id: 'test-user' },
        body: {
          opportunity_id: 'test-opp-123'
        },
        headers: {
          'x-csrf-token': 'valid-token'
        }
      })

      // Override mock
      context.mockSupabase = mockSupabase as any

      const response = await POST(context.request)
      const data = await response.json()
      
      expect(data.saved).toBe(false)
      expect(mockSupabase.from().delete).toHaveBeenCalled()

      await context.cleanup()
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors during save', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' }
                })
              })
            })
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Insert failed')
            })
          })
        })
      }

      const context = await setupApiTest('POST', '/api/opportunities/save', {
        user: { id: 'test-user' },
        body: {
          opportunity_id: 'test-opp-123'
        },
        headers: {
          'x-csrf-token': 'valid-token'
        }
      })

      context.mockSupabase = mockSupabase as any

      const response = await POST(context.request)
      
      await assertApiError(response, 500, 'DATABASE_ERROR')

      await context.cleanup()
    })

    it('should handle database errors during unsave', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'save-123' },
                  error: null
                })
              })
            })
          }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Delete failed')
              })
            })
          })
        })
      }

      const context = await setupApiTest('POST', '/api/opportunities/save', {
        user: { id: 'test-user' },
        body: {
          opportunity_id: 'test-opp-123'
        },
        headers: {
          'x-csrf-token': 'valid-token'
        }
      })

      context.mockSupabase = mockSupabase as any

      const response = await POST(context.request)
      
      await assertApiError(response, 500, 'DATABASE_ERROR')

      await context.cleanup()
    })
  })
})