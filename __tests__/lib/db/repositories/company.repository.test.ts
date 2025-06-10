/**
 * Company Repository Unit Tests
 * 
 * Tests company-specific operations including profile management,
 * subscription handling, and company statistics
 */

import { CompanyRepository } from '@/lib/db/repositories/company.repository'
import { NotFoundError, ValidationError } from '@/lib/errors/types'
import { 
  createMockSupabaseClient,
  ErrorScenarios
} from '@/__tests__/utils/db-test-helper'
import { 
  mockCompanies,
  mockProfiles,
  mockOpportunities,
  mockProposals,
  TestDataFactory
} from '@/__tests__/mocks/db-data'

// Mock the validator
jest.mock('@/lib/validation/services/company-validator', () => ({
  CompanyValidator: {
    validateCompany: jest.fn((data) => Promise.resolve(data))
  }
}))

// Mock performance monitoring
jest.mock('@/lib/monitoring/performance', () => ({
  startSpan: jest.fn(() => ({
    setStatus: jest.fn(),
    finish: jest.fn()
  }))
}))

describe('CompanyRepository', () => {
  let repository: CompanyRepository
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    repository = new CompanyRepository(mockSupabase)
    jest.clearAllMocks()
  })

  describe('findByIdWithDetails', () => {
    it('should get company with all related data', async () => {
      const companyWithDetails = {
        ...mockCompanies[0],
        profiles: mockProfiles.filter(p => p.company_id === 'company-1'),
        active_users_count: 2,
        proposals_count: 5,
        saved_opportunities_count: 10
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'companies.select': { data: companyWithDetails, error: null }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      const result = await repository.findByIdWithDetails('company-1')

      expect(result).toBeTruthy()
      expect(result?.id).toBe('company-1')
      expect(result?.profiles).toHaveLength(2)
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.select).toHaveBeenCalledWith(expect.stringContaining('profiles'))
      expect(query.eq).toHaveBeenCalledWith('id', 'company-1')
    })

    it('should return null when company not found', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'companies.select': ErrorScenarios.postgresErrors.notFound
        }
      })
      repository = new CompanyRepository(mockSupabase)

      const result = await repository.findByIdWithDetails('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('updateOnboarding', () => {
    it('should update company onboarding data', async () => {
      const onboardingData = {
        naics_codes: ['339112', '339113'],
        certifications: ['ISO 9001', 'ISO 13485'],
        description: 'Updated company description',
        sam_registration_date: '2024-01-01',
        sam_expiration_date: '2025-01-01'
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'companies.update': { 
            data: { ...mockCompanies[0], ...onboardingData }, 
            error: null 
          }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      const result = await repository.updateOnboarding('company-1', onboardingData)

      expect(result.naics_codes).toEqual(['339112', '339113'])
      expect(result.certifications).toEqual(['ISO 9001', 'ISO 13485'])
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
        naics_codes: ['339112', '339113'],
        certifications: ['ISO 9001', 'ISO 13485']
      }))
    })

    it('should validate NAICS codes', async () => {
      const invalidData = {
        naics_codes: ['123', 'invalid'], // Invalid NAICS codes
        certifications: []
      }

      // Mock validator to throw error
      const { CompanyValidator } = require('@/lib/validation/services/company-validator')
      CompanyValidator.validateCompany.mockRejectedValueOnce(
        new ValidationError('Invalid NAICS codes')
      )

      await expect(repository.updateOnboarding('company-1', invalidData))
        .rejects.toThrow(ValidationError)
    })
  })

  describe('addUser', () => {
    it('should add user to company', async () => {
      const newProfile = {
        email: 'newuser@company.com',
        full_name: 'New User',
        role: 'member' as const
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.insert': { 
            data: { 
              ...newProfile,
              id: 'new-user-id',
              company_id: 'company-1',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            }, 
            error: null 
          }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      const result = await repository.addUser('company-1', 'new-user-id', newProfile)

      expect(result.email).toBe('newuser@company.com')
      expect(result.company_id).toBe('company-1')
      expect(result.role).toBe('member')
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
        id: 'new-user-id',
        company_id: 'company-1',
        email: 'newuser@company.com',
        role: 'member'
      }))
    })

    it('should handle user already exists error', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'profiles.insert': ErrorScenarios.postgresErrors.uniqueViolation
        }
      })
      repository = new CompanyRepository(mockSupabase)

      await expect(repository.addUser('company-1', 'existing-user', {
        email: 'existing@company.com',
        full_name: 'Existing User',
        role: 'member'
      })).rejects.toThrow('already exists')
    })
  })

  describe('removeUser', () => {
    it('should remove user from company', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.update': { 
            data: { ...mockProfiles[1], company_id: null }, 
            error: null 
          }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      await repository.removeUser('company-1', 'user-2')

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.update).toHaveBeenCalledWith({ 
        company_id: null,
        role: null 
      })
      expect(query.eq).toHaveBeenCalledWith('id', 'user-2')
      expect(query.eq).toHaveBeenCalledWith('company_id', 'company-1')
    })

    it('should not allow removing the last owner', async () => {
      // First mock to check if last owner
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': [{ id: 'user-1' }] // Return actual owner data
        }
      })
      repository = new CompanyRepository(mockSupabase)

      await expect(repository.removeUser('company-1', 'user-1'))
        .rejects.toThrow('Cannot remove the last owner')
    })
  })

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.update': { 
            data: { ...mockProfiles[1], role: 'admin' }, 
            error: null 
          }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      const result = await repository.updateUserRole('company-1', 'user-2', 'admin')

      expect(result.role).toBe('admin')
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.update).toHaveBeenCalledWith({ role: 'admin' })
      expect(query.eq).toHaveBeenCalledWith('id', 'user-2')
      expect(query.eq).toHaveBeenCalledWith('company_id', 'company-1')
    })

    it('should validate role transitions', async () => {
      // Cannot promote member directly to owner
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { role: 'member' } // Current user is a member
        }
      })
      repository = new CompanyRepository(mockSupabase)

      await expect(repository.updateUserRole('company-1', 'user-2', 'owner'))
        .rejects.toThrow('Cannot promote member directly to owner')
    })
  })

  describe('updateSubscription', () => {
    it('should update subscription details', async () => {
      const subscriptionUpdate = {
        subscription_plan: 'professional' as const,
        subscription_status: 'active' as const,
        stripe_customer_id: 'cus_newcustomer',
        stripe_subscription_id: 'sub_newsubscription'
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'companies.update': { 
            data: { ...mockCompanies[0], ...subscriptionUpdate }, 
            error: null 
          }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      const result = await repository.updateSubscription('company-1', subscriptionUpdate)

      expect(result.subscription_plan).toBe('professional')
      expect(result.subscription_status).toBe('active')
      expect(result.stripe_customer_id).toBe('cus_newcustomer')
    })

    it('should handle subscription not found', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'companies.update': ErrorScenarios.postgresErrors.notFound
        }
      })
      repository = new CompanyRepository(mockSupabase)

      await expect(repository.updateSubscription('non-existent', {
        subscription_status: 'canceled'
      })).rejects.toThrow(NotFoundError)
    })
  })

  describe('getStatistics', () => {
    it('should calculate company statistics', async () => {
      // Mock multiple queries for statistics
      const mockResponses = {
        // Active users count
        'profiles.select': { data: null, error: null, count: 5 },
        // Total opportunities
        'opportunities.select': { data: null, error: null, count: 150 },
        // Saved opportunities
        'saved_opportunities.select': { data: null, error: null, count: 25 },
        // Active proposals
        'proposals.select': { data: null, error: null, count: 10 },
        // Recent activity (opportunities)
        'opportunities.select.recent': { 
          data: mockOpportunities.slice(0, 5), 
          error: null 
        },
        // Recent proposals
        'proposals.select.recent': { 
          data: mockProposals.slice(0, 5), 
          error: null 
        }
      }

      let queryCount = 0
      const queryOrder = [
        'profiles', 'opportunities', 'saved_opportunities', 
        'proposals', 'proposals', 'opportunities', 'proposals'
      ]

      mockSupabase.from = jest.fn((table) => {
        const currentQuery = queryOrder[queryCount++]
        const isRecent = queryCount > 4
        const key = isRecent ? `${table}.select.recent` : `${table}.select`
        const response = mockResponses[key as keyof typeof mockResponses]

        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          then: jest.fn((onFulfilled) => 
            Promise.resolve(response).then(onFulfilled)
          )
        }
      })

      repository = new CompanyRepository(mockSupabase)
      const stats = await repository.getStatistics('company-1')

      expect(stats).toEqual({
        totalUsers: 5,
        activeUsers: 5,
        totalOpportunities: 150,
        savedOpportunities: 25,
        activeProposals: 10,
        submittedProposals: 10,
        wonProposals: 0,
        conversionRate: 0,
        recentActivity: expect.any(Array)
      })
    })

    it('should calculate conversion rate correctly', async () => {
      // Mock with specific proposal statuses
      let queryCount = 0
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        then: jest.fn((onFulfilled) => {
          const counts = [5, 100, 25, 10, 20, 8] // 8 won out of 20 submitted
          const response = { 
            data: queryCount > 5 ? [] : null, 
            error: null, 
            count: counts[queryCount++] 
          }
          return Promise.resolve(response).then(onFulfilled)
        })
      })) as any

      repository = new CompanyRepository(mockSupabase)
      const stats = await repository.getStatistics('company-1')

      expect(stats.submittedProposals).toBe(20)
      expect(stats.wonProposals).toBe(8)
      expect(stats.conversionRate).toBe(40) // 8/20 * 100
    })
  })

  describe('findByStripeCustomerId', () => {
    it('should find company by Stripe customer ID', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'companies.select': { data: mockCompanies[0], error: null }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      const result = await repository.findByStripeCustomerId('cus_test123')

      expect(result).toBeTruthy()
      expect(result?.stripe_customer_id).toBe('cus_test123')
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('stripe_customer_id', 'cus_test123')
    })

    it('should return null when not found', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'companies.select': { data: null, error: null }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      const result = await repository.findByStripeCustomerId('cus_nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('getActiveUsers', () => {
    it('should get active users for company', async () => {
      const activeUsers = mockProfiles.filter(p => p.company_id === 'company-1')
      
      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: activeUsers, error: null }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      const result = await repository.getActiveUsers('company-1')

      expect(result).toHaveLength(2)
      expect(result[0].company_id).toBe('company-1')
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('company_id', 'company-1')
      expect(query.order).toHaveBeenCalledWith('last_activity_at', { ascending: false })
    })

    it('should filter by activity date', async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      mockSupabase = createMockSupabaseClient({
        responses: {
          'profiles.select': { data: [], error: null }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      await repository.getActiveUsers('company-1', thirtyDaysAgo)

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.gte).toHaveBeenCalledWith(
        'last_activity_at', 
        thirtyDaysAgo.toISOString()
      )
    })
  })

  describe('bulkUpdateCompanies', () => {
    it('should update multiple companies', async () => {
      const companies = TestDataFactory.createBulkOpportunities(50).map((_, i) => ({
        id: `company-${i}`,
        sam_expiration_date: '2024-12-31'
      }))

      mockSupabase = createMockSupabaseClient({
        responses: {
          'companies.upsert': { 
            data: companies.map(c => ({ ...mockCompanies[0], ...c })), 
            error: null 
          }
        }
      })
      repository = new CompanyRepository(mockSupabase)

      const result = await repository.bulkUpdateCompanies(companies as any)

      expect(result).toBe(50)
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.upsert).toHaveBeenCalledWith(
        companies,
        { onConflict: 'id' }
      )
    })

    it('should handle empty array', async () => {
      const result = await repository.bulkUpdateCompanies([])
      expect(result).toBe(0)
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'companies.select': new Error('Connection refused')
        }
      })
      repository = new CompanyRepository(mockSupabase)

      await expect(repository.findById('company-1'))
        .rejects.toThrow('Database operation failed')
    })

    it('should handle validation errors from validator', async () => {
      const { CompanyValidator } = require('@/lib/validation/services/company-validator')
      CompanyValidator.validateCompany.mockRejectedValueOnce(
        new ValidationError('Invalid company data', [
          { path: ['name'], message: 'Company name is required' }
        ])
      )

      await expect(repository.create({} as any))
        .rejects.toThrow(ValidationError)
    })
  })
})