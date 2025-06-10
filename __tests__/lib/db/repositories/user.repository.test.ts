/**
 * User Repository Unit Tests
 * 
 * Tests user/profile operations including preferences,
 * activity tracking, and user search functionality
 */

import { UserRepository } from '@/lib/db/repositories/user.repository'
import { NotFoundError, ValidationError } from '@/lib/errors/types'
import { 
  createMockSupabaseClient,
  ErrorScenarios
} from '@/__tests__/utils/db-test-helper'
import { 
  mockProfiles,
  mockCompanies,
  TestDataFactory
} from '@/__tests__/mocks/db-data'

// Mock performance monitoring
jest.mock('@/lib/monitoring/performance', () => ({
  startSpan: jest.fn(() => ({
    setStatus: jest.fn(),
    finish: jest.fn()
  }))
}))

describe('UserRepository', () => {
  let repository: UserRepository
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    repository = new UserRepository(mockSupabase)
    jest.clearAllMocks()
  })

  describe('findByIdWithCompany', () => {
    it('should get user profile with company details', async () => {
      const userWithCompany = {
        ...mockProfiles[0],
        companies: mockCompanies[0]
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: userWithCompany, error: null }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.findByIdWithCompany('user-1')

      expect(result).toBeTruthy()
      expect(result?.id).toBe('user-1')
      expect(result?.companies).toBeTruthy()
      expect(result?.companies?.name).toBe('MedTech Solutions Inc.')
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.select).toHaveBeenCalledWith('*, companies(*)')
      expect(query.eq).toHaveBeenCalledWith('id', 'user-1')
    })

    it('should return null when user not found', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'profiles.select': ErrorScenarios.postgresErrors.notFound
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.findByIdWithCompany('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('findByEmail', () => {
    it('should find user by email address', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: mockProfiles[0], error: null }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.findByEmail('john.doe@medtechsolutions.com')

      expect(result).toBeTruthy()
      expect(result?.email).toBe('john.doe@medtechsolutions.com')
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('email', 'john.doe@medtechsolutions.com')
    })

    it('should normalize email to lowercase', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: mockProfiles[0], error: null }
        }
      })
      repository = new UserRepository(mockSupabase)

      await repository.findByEmail('John.Doe@MedTechSolutions.COM')

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('email', 'john.doe@medtechsolutions.com')
    })

    it('should return null when email not found', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: null, error: null }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.findByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })
  })

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const newPreferences = {
        email_notifications: {
          opportunity_matches: false,
          deadline_reminders: true,
          weekly_summary: false,
          proposal_updates: true
        },
        ui_preferences: {
          theme: 'dark' as const,
          compact_view: true,
          default_opportunity_view: 'grid' as const
        },
        search_preferences: {
          default_naics_codes: ['339112'],
          default_set_asides: ['WOSB'],
          default_agencies: ['VA'],
          saved_searches: []
        }
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.update': { 
            data: { ...mockProfiles[0], preferences: newPreferences }, 
            error: null 
          }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.updatePreferences('user-1', newPreferences)

      expect(result.preferences).toEqual(newPreferences)
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.update).toHaveBeenCalledWith({ preferences: newPreferences })
      expect(query.eq).toHaveBeenCalledWith('id', 'user-1')
    })

    it('should merge preferences with existing ones', async () => {
      const partialUpdate = {
        ui_preferences: {
          theme: 'dark' as const
        }
      }

      // First get existing preferences
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: mockProfiles[0], error: null },
          'profiles.update': { 
            data: { 
              ...mockProfiles[0], 
              preferences: {
                ...mockProfiles[0].preferences,
                ui_preferences: {
                  ...mockProfiles[0].preferences?.ui_preferences,
                  theme: 'dark'
                }
              }
            }, 
            error: null 
          }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.updatePreferences('user-1', partialUpdate)

      // Should preserve other preferences
      expect(result.preferences?.email_notifications).toBeTruthy()
      expect(result.preferences?.ui_preferences?.theme).toBe('dark')
      expect(result.preferences?.ui_preferences?.compact_view).toBe(false) // Original value
    })

    it('should handle missing preferences gracefully', async () => {
      const userWithoutPrefs = { ...mockProfiles[0], preferences: null }
      
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: userWithoutPrefs, error: null },
          'profiles.update': { 
            data: { 
              ...userWithoutPrefs, 
              preferences: { ui_preferences: { theme: 'dark' } }
            }, 
            error: null 
          }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.updatePreferences('user-1', {
        ui_preferences: { theme: 'dark' as const }
      })

      expect(result.preferences?.ui_preferences?.theme).toBe('dark')
    })
  })

  describe('updateOnboardingStatus', () => {
    it('should mark onboarding as completed', async () => {
      const now = new Date()
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime())

      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.update': { 
            data: { 
              ...mockProfiles[0], 
              onboarding_completed: true,
              onboarding_completed_at: now.toISOString()
            }, 
            error: null 
          }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.updateOnboardingStatus('user-1', true)

      expect(result.onboarding_completed).toBe(true)
      expect(result.onboarding_completed_at).toBe(now.toISOString())
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.update).toHaveBeenCalledWith({
        onboarding_completed: true,
        onboarding_completed_at: now.toISOString()
      })
    })

    it('should clear completion timestamp when reverting', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.update': { 
            data: { 
              ...mockProfiles[0], 
              onboarding_completed: false,
              onboarding_completed_at: null
            }, 
            error: null 
          }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.updateOnboardingStatus('user-1', false)

      expect(result.onboarding_completed).toBe(false)
      expect(result.onboarding_completed_at).toBeNull()
    })
  })

  describe('updateLastActivity', () => {
    it('should update last activity timestamp', async () => {
      const now = new Date()
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime())

      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.update': { 
            data: { 
              ...mockProfiles[0], 
              last_activity_at: now.toISOString()
            }, 
            error: null 
          }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.updateLastActivity('user-1')

      expect(result.last_activity_at).toBe(now.toISOString())
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.update).toHaveBeenCalledWith({
        last_activity_at: now.toISOString()
      })
    })

    it('should not throw on update failure', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'profiles.update': new Error('Update failed')
        }
      })
      repository = new UserRepository(mockSupabase)

      // Should not throw - activity updates are non-critical
      await expect(repository.updateLastActivity('user-1'))
        .resolves.not.toThrow()
    })
  })

  describe('searchByCompany', () => {
    it('should search users within company', async () => {
      const companyUsers = mockProfiles.filter(p => p.company_id === 'company-1')
      
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: companyUsers, error: null }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.searchByCompany('company-1', {
        query: 'john'
      })

      expect(result).toHaveLength(1)
      expect(result[0].full_name).toBe('John Doe')
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('company_id', 'company-1')
      expect(query.or).toHaveBeenCalledWith(
        'full_name.ilike.%john%,email.ilike.%john%'
      )
    })

    it('should filter by role', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: [mockProfiles[0]], error: null }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.searchByCompany('company-1', {
        role: 'owner'
      })

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe('owner')
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('role', 'owner')
    })

    it('should filter by department', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: [], error: null }
        }
      })
      repository = new UserRepository(mockSupabase)

      await repository.searchByCompany('company-1', {
        department: 'Sales'
      })

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('department', 'Sales')
    })

    it('should filter by active status', async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: mockProfiles, error: null }
        }
      })
      repository = new UserRepository(mockSupabase)

      await repository.searchByCompany('company-1', {
        onlyActive: true
      })

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.gte).toHaveBeenCalledWith(
        'last_activity_at',
        expect.stringContaining(thirtyDaysAgo.toISOString().split('T')[0])
      )
    })

    it('should order results by name', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: mockProfiles, error: null }
        }
      })
      repository = new UserRepository(mockSupabase)

      await repository.searchByCompany('company-1')

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.order).toHaveBeenCalledWith('full_name', { ascending: true })
    })
  })

  describe('getActivity', () => {
    it('should get user activity summary', async () => {
      const userId = 'user-1'
      const activityData = {
        saved_opportunities: 15,
        proposals_created: 5,
        proposals_submitted: 3,
        analyses_requested: 10,
        last_login: '2024-01-10T15:00:00Z',
        last_search: '2024-01-10T14:30:00Z'
      }

      // Mock multiple count queries
      let queryCount = 0
      const tables = ['saved_opportunities', 'proposals', 'proposals', 'opportunity_analyses']
      
      mockSupabase.from = jest.fn((table) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((onFulfilled) => {
          if (queryCount < 4) {
            // Count queries
            const counts = [15, 5, 3, 10]
            const response = { 
              data: null, 
              error: null, 
              count: counts[queryCount++] 
            }
            return Promise.resolve(response).then(onFulfilled)
          } else {
            // Activity log query
            const response = {
              data: [
                { action: 'login', created_at: activityData.last_login },
                { action: 'search', created_at: activityData.last_search }
              ],
              error: null
            }
            return Promise.resolve(response).then(onFulfilled)
          }
        })
      })) as any

      repository = new UserRepository(mockSupabase)
      const result = await repository.getActivity(userId)

      expect(result).toEqual({
        savedOpportunities: 15,
        proposalsCreated: 5,
        proposalsSubmitted: 3,
        analysesRequested: 10,
        lastLogin: new Date(activityData.last_login),
        lastSearch: new Date(activityData.last_search),
        recentActions: expect.any(Array)
      })
    })

    it('should handle missing activity data', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((onFulfilled) => 
          Promise.resolve({ data: null, error: null, count: 0 }).then(onFulfilled)
        )
      })) as any

      repository = new UserRepository(mockSupabase)
      const result = await repository.getActivity('user-1')

      expect(result.savedOpportunities).toBe(0)
      expect(result.proposalsCreated).toBe(0)
      expect(result.lastLogin).toBeNull()
    })
  })

  describe('createInitialProfile', () => {
    it('should create profile for new user', async () => {
      const authUser = {
        id: 'auth-user-id',
        email: 'newuser@example.com'
      }

      const profileData = {
        full_name: 'New User',
        company_id: 'company-1',
        role: 'member' as const
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.insert': { 
            data: {
              id: authUser.id,
              email: authUser.email,
              ...profileData,
              onboarding_completed: false,
              created_at: '2024-01-15T00:00:00Z',
              updated_at: '2024-01-15T00:00:00Z'
            }, 
            error: null 
          }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.createInitialProfile(authUser, profileData)

      expect(result.id).toBe(authUser.id)
      expect(result.email).toBe(authUser.email)
      expect(result.company_id).toBe('company-1')
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.insert).toHaveBeenCalledWith({
        id: authUser.id,
        email: authUser.email,
        ...profileData,
        onboarding_completed: false
      })
    })

    it('should handle profile already exists', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'profiles.insert': ErrorScenarios.postgresErrors.uniqueViolation
        }
      })
      repository = new UserRepository(mockSupabase)

      await expect(repository.createInitialProfile(
        { id: 'existing-id', email: 'existing@example.com' },
        { full_name: 'Existing User' }
      )).rejects.toThrow('already exists')
    })
  })

  describe('bulkUpdateLastActivity', () => {
    it('should update multiple users activity timestamps', async () => {
      const userIds = ['user-1', 'user-2', 'user-3']
      const now = new Date()
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime())

      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.update': { 
            data: userIds.map(id => ({ 
              id, 
              last_activity_at: now.toISOString() 
            })), 
            error: null 
          }
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.bulkUpdateLastActivity(userIds)

      expect(result).toBe(3)
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.update).toHaveBeenCalledWith({
        last_activity_at: now.toISOString()
      })
      expect(query.in).toHaveBeenCalledWith('id', userIds)
    })

    it('should handle empty array', async () => {
      const result = await repository.bulkUpdateLastActivity([])
      expect(result).toBe(0)
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  describe('getTeamMembers', () => {
    it('should get all users in same company', async () => {
      const teamMembers = mockProfiles.filter(p => p.company_id === 'company-1')
      
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { 
            data: { company_id: 'company-1' }, 
            error: null 
          }
        }
      })
      
      // Second query for team members
      const secondMock = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: teamMembers, error: null }
        }
      })
      
      // First call gets user's company, second gets team
      let callCount = 0
      repository = new UserRepository(
        callCount++ === 0 ? mockSupabase : secondMock
      )

      // Need to mock both calls
      repository.findById = jest.fn()
        .mockResolvedValueOnce({ company_id: 'company-1' })
      
      repository.findAll = jest.fn()
        .mockResolvedValueOnce(teamMembers)

      const result = await repository.getTeamMembers('user-1')

      expect(result).toHaveLength(2)
      expect(result.every(m => m.company_id === 'company-1')).toBe(true)
    })

    it('should exclude users without company', async () => {
      repository.findById = jest.fn()
        .mockResolvedValueOnce({ company_id: null })

      const result = await repository.getTeamMembers('user-1')

      expect(result).toEqual([])
    })
  })

  describe('Error Handling', () => {
    it('should handle profile not found', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'profiles.select': ErrorScenarios.postgresErrors.notFound
        }
      })
      repository = new UserRepository(mockSupabase)

      const result = await repository.findById('non-existent')
      expect(result).toBeNull()
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'profiles.update': new Error('Connection timeout')
        }
      })
      repository = new UserRepository(mockSupabase)

      await expect(repository.update('user-1', { full_name: 'Updated' }))
        .rejects.toThrow('Database operation failed')
    })

    it('should validate email format', async () => {
      await expect(repository.findByEmail('invalid-email'))
        .rejects.toThrow('Invalid email format')
    })
  })
})