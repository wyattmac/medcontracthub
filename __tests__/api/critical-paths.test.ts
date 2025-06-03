/**
 * Critical Path API Tests
 * Tests for core API functionality
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn()
}))

jest.mock('@/lib/errors/logger', () => ({
  apiLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}))

describe('Critical API Paths', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        limit: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis()
      }))
    }
    
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  describe('Health Check Endpoint', () => {
    it('should return healthy status', async () => {
      const { GET } = await import('@/app/api/health/route')
      const request = new NextRequest('http://localhost:3000/api/health')
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.timestamp).toBeDefined()
    })
  })

  describe('Authentication Flow', () => {
    it('should protect authenticated routes', async () => {
      // Mock unauthenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const { GET } = await import('@/app/api/opportunities/saved/route')
      const request = new NextRequest('http://localhost:3000/api/opportunities/saved')
      
      const response = await GET(request)
      
      expect(response.status).toBe(401)
    })

    it('should allow authenticated users', async () => {
      // Mock authenticated user
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      
      // Mock saved opportunities query
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      const { GET } = await import('@/app/api/opportunities/saved/route')
      const request = new NextRequest('http://localhost:3000/api/opportunities/saved')
      
      const response = await GET(request)
      
      expect(response.status).toBe(200)
    })
  })

  describe('Data Operations', () => {
    it('should handle opportunity search', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      
      const mockOpportunities = [
        {
          id: 'opp-1',
          title: 'Medical Supplies Contract',
          agency: 'Department of Veterans Affairs',
          status: 'active'
        }
      ]
      
      mockSupabase.from().select().limit().order().mockResolvedValue({
        data: mockOpportunities,
        error: null
      })

      const { GET } = await import('@/app/api/opportunities/search/route')
      const request = new NextRequest('http://localhost:3000/api/opportunities/search?limit=10')
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.opportunities).toBeDefined()
      expect(Array.isArray(data.opportunities)).toBe(true)
    })

    it('should save opportunities with proper validation', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: { company_id: 'company-123' }
      }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      
      // Mock successful insert
      mockSupabase.from().insert().select().single().mockResolvedValue({
        data: {
          id: 'saved-1',
          opportunity_id: 'opp-123',
          user_id: 'user-123',
          company_id: 'company-123'
        },
        error: null
      })

      const { POST } = await import('@/app/api/opportunities/save/route')
      const request = new NextRequest('http://localhost:3000/api/opportunities/save', {
        method: 'POST',
        body: JSON.stringify({ opportunityId: 'opp-123' })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      
      // Mock database error
      mockSupabase.from().select().mockResolvedValue({
        data: null,
        error: new Error('Database connection failed')
      })

      const { GET } = await import('@/app/api/opportunities/search/route')
      const request = new NextRequest('http://localhost:3000/api/opportunities/search')
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('should validate request parameters', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const { POST } = await import('@/app/api/opportunities/save/route')
      const request = new NextRequest('http://localhost:3000/api/opportunities/save', {
        method: 'POST',
        body: JSON.stringify({}) // Missing required opportunityId
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(400)
    })
  })

  describe('Performance Considerations', () => {
    it('should handle pagination properly', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      
      // Mock paginated response
      const limitMock = jest.fn().mockReturnThis()
      const orderMock = jest.fn().mockResolvedValue({
        data: Array(50).fill({ id: 'opp-1' }),
        error: null
      })
      
      mockSupabase.from().select().limit = limitMock
      mockSupabase.from().select().order = orderMock

      const { GET } = await import('@/app/api/opportunities/search/route')
      const request = new NextRequest('http://localhost:3000/api/opportunities/search?page=2&limit=50')
      
      await GET(request)
      
      expect(limitMock).toHaveBeenCalledWith(50)
    })
  })
})