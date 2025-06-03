/**
 * Tests for Reminders API
 * GET /api/reminders
 */

import { GET } from '@/app/api/reminders/route'
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

// Mock current date for consistent testing
const mockCurrentDate = new Date('2024-12-01T10:00:00Z')
const originalDate = Date
beforeAll(() => {
  global.Date = jest.fn((...args) => {
    if (args.length === 0) {
      return mockCurrentDate
    }
    return new originalDate(...args)
  }) as any
  global.Date.now = originalDate.now
  global.Date.parse = originalDate.parse
  global.Date.UTC = originalDate.UTC
})

afterAll(() => {
  global.Date = originalDate
})

// Mock data
const mockSavedOpportunityWithReminder = {
  id: 'saved-1',
  reminder_date: '2024-12-03T10:00:00Z', // 2 days from mock current date
  notes: 'Review technical requirements',
  tags: ['priority', 'medical'],
  is_pursuing: true,
  opportunities: {
    id: 'opp-1',
    title: 'Medical Equipment Contract',
    agency: 'Department of Health',
    response_deadline: '2024-12-15T23:59:59Z',
    status: 'active'
  }
}

const mockExpiringOpportunity = {
  id: 'opp-2',
  title: 'Surgical Supplies Contract',
  agency: 'Veterans Affairs',
  response_deadline: '2024-12-05T23:59:59Z', // 4 days from mock current date
  status: 'active',
  saved_opportunities: [{
    id: 'saved-2',
    user_id: mockUser.id,
    is_pursuing: true
  }]
}

describe('/api/reminders', () => {
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

      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)
      
      expect(response.status).toBe(401)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Successful reminders retrieval', () => {
    beforeEach(() => {
      // Mock saved opportunities with reminders
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [mockSavedOpportunityWithReminder],
            error: null
          })
        })
        // Mock expiring opportunities
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [mockExpiringOpportunity],
            error: null
          })
        })
    })

    it('should return upcoming reminders and expiring opportunities successfully', async () => {
      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        upcomingReminders: [
          expect.objectContaining({
            id: 'saved-1',
            reminder_date: '2024-12-03T10:00:00Z',
            notes: 'Review technical requirements',
            opportunities: expect.objectContaining({
              title: 'Medical Equipment Contract',
              agency: 'Department of Health'
            })
          })
        ],
        expiringOpportunities: [
          expect.objectContaining({
            id: 'opp-2',
            title: 'Surgical Supplies Contract',
            agency: 'Veterans Affairs',
            response_deadline: '2024-12-05T23:59:59Z'
          })
        ],
        stats: {
          todayReminders: 0,
          next7DaysReminders: 1,
          todayDeadlines: 0,
          next7DaysDeadlines: 1,
          totalUpcoming: 2
        }
      })
    })

    it('should query reminders with correct date range (30 days)', async () => {
      const mockReminderQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce(mockReminderQuery)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/reminders')
      await GET(request)

      expect(mockReminderQuery.eq).toHaveBeenCalledWith('user_id', mockUser.id)
      expect(mockReminderQuery.not).toHaveBeenCalledWith('reminder_date', 'is', null)
      expect(mockReminderQuery.gte).toHaveBeenCalledWith('reminder_date', mockCurrentDate.toISOString())
      
      // Check 30 days from now calculation
      const next30Days = new Date(mockCurrentDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      expect(mockReminderQuery.lte).toHaveBeenCalledWith('reminder_date', next30Days.toISOString())
    })

    it('should query expiring opportunities with correct date range (14 days)', async () => {
      const mockExpiringQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce(mockExpiringQuery)

      const request = createMockNextRequest('https://example.com/api/reminders')
      await GET(request)

      expect(mockExpiringQuery.eq).toHaveBeenCalledWith('status', 'active')
      expect(mockExpiringQuery.gte).toHaveBeenCalledWith('response_deadline', mockCurrentDate.toISOString())
      
      // Check 14 days from now calculation
      const next14Days = new Date(mockCurrentDate.getTime() + 14 * 24 * 60 * 60 * 1000)
      expect(mockExpiringQuery.lte).toHaveBeenCalledWith('response_deadline', next14Days.toISOString())
      expect(mockExpiringQuery.limit).toHaveBeenCalledWith(10)
    })

    it('should filter expiring opportunities to only include pursued saved ones', async () => {
      const opportunityNotPursued = {
        id: 'opp-3',
        title: 'Not Pursued Contract',
        agency: 'Test Agency',
        response_deadline: '2024-12-06T23:59:59Z',
        status: 'active',
        saved_opportunities: [{
          id: 'saved-3',
          user_id: mockUser.id,
          is_pursuing: false // Not being pursued
        }]
      }

      const opportunityNotSaved = {
        id: 'opp-4',
        title: 'Not Saved Contract',
        agency: 'Test Agency',
        response_deadline: '2024-12-07T23:59:59Z',
        status: 'active',
        saved_opportunities: [] // Not saved
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [
              mockExpiringOpportunity, // Should be included (is_pursuing: true)
              opportunityNotPursued,   // Should be excluded (is_pursuing: false)
              opportunityNotSaved      // Should be excluded (not saved)
            ],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.expiringOpportunities).toHaveLength(1)
      expect(data.expiringOpportunities[0].id).toBe('opp-2')
    })

    it('should calculate stats correctly', async () => {
      // Mock date for today's reminders/deadlines calculation
      const todayReminder = {
        ...mockSavedOpportunityWithReminder,
        id: 'saved-today',
        reminder_date: '2024-12-01T15:00:00Z' // Later today
      }

      const todayDeadline = {
        ...mockExpiringOpportunity,
        id: 'opp-today',
        response_deadline: '2024-12-01T20:00:00Z', // Today
        saved_opportunities: [{
          id: 'saved-today-deadline',
          user_id: mockUser.id,
          is_pursuing: true
        }]
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [todayReminder, mockSavedOpportunityWithReminder],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [todayDeadline, mockExpiringOpportunity],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(data.stats).toEqual({
        todayReminders: 1,
        next7DaysReminders: 1,
        todayDeadlines: 1,
        next7DaysDeadlines: 1,
        totalUpcoming: 4
      })
    })
  })

  describe('Empty data scenarios', () => {
    it('should handle empty reminders and opportunities gracefully', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        upcomingReminders: [],
        expiringOpportunities: [],
        stats: {
          todayReminders: 0,
          next7DaysReminders: 0,
          todayDeadlines: 0,
          next7DaysDeadlines: 0,
          totalUpcoming: 0
        }
      })
    })

    it('should handle null data from database gracefully', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data.upcomingReminders).toEqual([])
      expect(data.expiringOpportunities).toEqual([])
    })
  })

  describe('Error handling', () => {
    it('should handle reminders query errors', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })

      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)

      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Failed to fetch reminders')
    })

    it('should handle expiring opportunities query errors', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })

      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)

      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Failed to fetch expiring opportunities')
    })

    it('should handle unexpected errors', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)

      expect(response.status).toBe(500)
      
      const data = await extractResponseJson(response)
      expect(data.error).toBe('Internal server error')
      expect(data.details).toBe('Unexpected error')
    })
  })

  describe('Date handling', () => {
    it('should handle edge cases in date calculations', async () => {
      // Mock reminders at exact boundaries
      const exactlyNowReminder = {
        ...mockSavedOpportunityWithReminder,
        id: 'reminder-now',
        reminder_date: mockCurrentDate.toISOString()
      }

      const exactly30DaysReminder = {
        ...mockSavedOpportunityWithReminder,
        id: 'reminder-30days',
        reminder_date: new Date(mockCurrentDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [exactlyNowReminder, exactly30DaysReminder],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)
      const data = await extractResponseJson(response)

      expect(response.status).toBe(200)
      expect(data.upcomingReminders).toHaveLength(2)
    })

    it('should handle invalid date formats gracefully', async () => {
      const invalidDateReminder = {
        ...mockSavedOpportunityWithReminder,
        reminder_date: 'invalid-date'
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [invalidDateReminder],
            error: null
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/reminders')
      const response = await GET(request)

      // Should not crash, but might have incorrect stats
      expect(response.status).toBe(200)
    })
  })

  describe('Database query structure', () => {
    it('should query saved_opportunities table with correct joins', async () => {
      const mockReminderQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce(mockReminderQuery)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

      const request = createMockNextRequest('https://example.com/api/reminders')
      await GET(request)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('saved_opportunities')
      expect(mockReminderQuery.select).toHaveBeenCalledWith(expect.stringContaining('opportunities!inner('))
    })

    it('should query opportunities table with left join to saved_opportunities', async () => {
      const mockExpiringQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
        .mockReturnValueOnce(mockExpiringQuery)

      const request = createMockNextRequest('https://example.com/api/reminders')
      await GET(request)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('opportunities')
      expect(mockExpiringQuery.select).toHaveBeenCalledWith(expect.stringContaining('saved_opportunities!left('))
      expect(mockExpiringQuery.eq).toHaveBeenCalledWith('saved_opportunities.user_id', mockUser.id)
    })
  })
})