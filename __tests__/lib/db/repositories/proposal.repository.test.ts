/**
 * Proposal Repository Unit Tests
 * 
 * Tests proposal-specific operations including sections management,
 * status transitions, and proposal analytics
 */

import { ProposalRepository } from '@/lib/db/repositories/proposal.repository'
import { NotFoundError, ValidationError } from '@/lib/errors/types'
import { 
  createMockSupabaseClient,
  ErrorScenarios,
  PerformanceTracker
} from '@/__tests__/utils/db-test-helper'
import { 
  mockProposals,
  mockProposalSections,
  mockOpportunities,
  TestDataFactory
} from '@/__tests__/mocks/db-data'

// Mock the validator
jest.mock('@/lib/validation/services/proposal-validator', () => ({
  ProposalValidator: {
    validateProposal: jest.fn((data) => Promise.resolve(data)),
    validateSection: jest.fn((data) => Promise.resolve(data))
  }
}))

// Mock performance monitoring
jest.mock('@/lib/monitoring/performance', () => ({
  startSpan: jest.fn(() => ({
    setStatus: jest.fn(),
    finish: jest.fn()
  }))
}))

describe('ProposalRepository', () => {
  let repository: ProposalRepository
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>
  let performanceTracker: PerformanceTracker

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    repository = new ProposalRepository(mockSupabase)
    performanceTracker = new PerformanceTracker()
    jest.clearAllMocks()
  })

  describe('findByIdWithDetails', () => {
    it('should get proposal with all related data', async () => {
      const proposalWithDetails = {
        ...mockProposals[0],
        proposal_sections: mockProposalSections,
        opportunities: mockOpportunities[0],
        proposal_documents: [
          {
            id: 'doc-1',
            proposal_id: 'proposal-1',
            document_name: 'Technical Proposal.pdf',
            file_size: 1024000,
            created_at: '2024-01-10T00:00:00Z'
          }
        ]
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { data: proposalWithDetails, error: null }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      const result = await repository.findByIdWithDetails('proposal-1')

      expect(result).toBeTruthy()
      expect(result?.id).toBe('proposal-1')
      expect(result?.proposal_sections).toHaveLength(2)
      expect(result?.opportunities).toBeTruthy()
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.select).toHaveBeenCalledWith(expect.stringContaining('proposal_sections'))
      expect(query.select).toHaveBeenCalledWith(expect.stringContaining('opportunities'))
      expect(query.eq).toHaveBeenCalledWith('id', 'proposal-1')
    })

    it('should order sections by display_order', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { 
            data: { ...mockProposals[0], proposal_sections: [] }, 
            error: null 
          }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      await repository.findByIdWithDetails('proposal-1')

      const query = mockSupabase.from.mock.results[0]?.value
      const selectCall = query.select.mock.calls[0][0]
      expect(selectCall).toContain('proposal_sections!inner(display_order)')
    })
  })

  describe('findByCompany', () => {
    it('should get proposals for company with pagination', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { 
            data: mockProposals,
            error: null,
            count: 15
          }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      const result = await repository.findByCompany('company-1', {
        page: 1,
        pageSize: 10,
        status: 'draft'
      })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(15)
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('company_id', 'company-1')
      expect(query.eq).toHaveBeenCalledWith('status', 'draft')
    })

    it('should filter by multiple statuses', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { data: [], error: null, count: 0 }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      await repository.findByCompany('company-1', {
        statuses: ['draft', 'submitted']
      })

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.in).toHaveBeenCalledWith('status', ['draft', 'submitted'])
    })

    it('should order by deadline', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { data: mockProposals, error: null, count: 2 }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      await repository.findByCompany('company-1', {
        orderBy: 'deadline'
      })

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.order).toHaveBeenCalledWith('submission_deadline', { ascending: true })
    })
  })

  describe('createWithSections', () => {
    it('should create proposal with sections in transaction', async () => {
      const newProposal = {
        title: 'New Proposal',
        opportunity_id: 'opp-1',
        user_id: 'user-1',
        company_id: 'company-1',
        status: 'draft' as const
      }

      const sections = [
        {
          section_type: 'technical' as const,
          title: 'Technical Approach',
          content: 'Our approach...',
          display_order: 1
        },
        {
          section_type: 'pricing' as const,
          title: 'Pricing',
          content: 'Cost breakdown...',
          display_order: 2
        }
      ]

      const createdProposal = {
        ...newProposal,
        id: 'new-proposal-id',
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.insert': { data: createdProposal, error: null },
          'proposal_sections.insert': { 
            data: sections.map((s, i) => ({ 
              ...s, 
              id: `section-${i}`,
              proposal_id: 'new-proposal-id' 
            })), 
            error: null 
          }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      const result = await repository.createWithSections(newProposal, sections)

      expect(result.id).toBe('new-proposal-id')
      expect(mockSupabase.from).toHaveBeenCalledTimes(2)
      
      // Check proposal creation
      const proposalQuery = mockSupabase.from.mock.results[0]?.value
      expect(proposalQuery.insert).toHaveBeenCalledWith(newProposal)
      
      // Check sections creation
      const sectionsQuery = mockSupabase.from.mock.results[1]?.value
      expect(sectionsQuery.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            proposal_id: 'new-proposal-id',
            section_type: 'technical'
          })
        ])
      )
    })

    it('should validate proposal data', async () => {
      const { ProposalValidator } = require('@/lib/validation/services/proposal-validator')
      ProposalValidator.validateProposal.mockRejectedValueOnce(
        new ValidationError('Invalid proposal data')
      )

      await expect(repository.createWithSections({} as any, []))
        .rejects.toThrow(ValidationError)
    })
  })

  describe('updateSection', () => {
    it('should update proposal section', async () => {
      const sectionUpdate = {
        content: 'Updated content',
        title: 'Updated Title'
      }

      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposal_sections.update': { 
            data: { ...mockProposalSections[0], ...sectionUpdate }, 
            error: null 
          }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      const result = await repository.updateSection(
        'proposal-1',
        'section-1',
        sectionUpdate
      )

      expect(result.content).toBe('Updated content')
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.update).toHaveBeenCalledWith(sectionUpdate)
      expect(query.eq).toHaveBeenCalledWith('id', 'section-1')
      expect(query.eq).toHaveBeenCalledWith('proposal_id', 'proposal-1')
    })

    it('should validate section data', async () => {
      const { ProposalValidator } = require('@/lib/validation/services/proposal-validator')
      ProposalValidator.validateSection.mockRejectedValueOnce(
        new ValidationError('Section content too long')
      )

      await expect(repository.updateSection('proposal-1', 'section-1', {
        content: 'x'.repeat(100000) // Too long
      })).rejects.toThrow(ValidationError)
    })
  })

  describe('reorderSections', () => {
    it('should update section display orders', async () => {
      const sectionOrders = [
        { id: 'section-1', display_order: 2 },
        { id: 'section-2', display_order: 1 },
        { id: 'section-3', display_order: 3 }
      ]

      // Mock individual update responses
      let updateCount = 0
      mockSupabase.from = jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        then: jest.fn((onFulfilled) => {
          const response = {
            data: { ...mockProposalSections[0], ...sectionOrders[updateCount++] },
            error: null
          }
          return Promise.resolve(response).then(onFulfilled)
        })
      })) as any

      repository = new ProposalRepository(mockSupabase)

      await repository.reorderSections('proposal-1', sectionOrders)

      expect(mockSupabase.from).toHaveBeenCalledTimes(3)
    })

    it('should handle reorder errors', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'proposal_sections.update': new Error('Update failed')
        }
      })
      repository = new ProposalRepository(mockSupabase)

      await expect(repository.reorderSections('proposal-1', [
        { id: 'section-1', display_order: 1 }
      ])).rejects.toThrow('Database operation failed')
    })
  })

  describe('updateStatus', () => {
    it('should update proposal status with timestamp', async () => {
      const now = new Date()
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime())

      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.update': { 
            data: { 
              ...mockProposals[0], 
              status: 'submitted',
              actual_submission_date: now.toISOString()
            }, 
            error: null 
          }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      const result = await repository.updateStatus('proposal-1', 'submitted')

      expect(result.status).toBe('submitted')
      expect(result.actual_submission_date).toBe(now.toISOString())
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.update).toHaveBeenCalledWith({
        status: 'submitted',
        actual_submission_date: now.toISOString()
      })
    })

    it('should clear submission date when reverting to draft', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.update': { 
            data: { 
              ...mockProposals[0], 
              status: 'draft',
              actual_submission_date: null
            }, 
            error: null 
          }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      await repository.updateStatus('proposal-1', 'draft')

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.update).toHaveBeenCalledWith({
        status: 'draft',
        actual_submission_date: null
      })
    })

    it('should validate status transitions', async () => {
      // Cannot transition from won to draft
      const { ProposalValidator } = require('@/lib/validation/services/proposal-validator')
      ProposalValidator.validateProposal.mockRejectedValueOnce(
        new ValidationError('Invalid status transition')
      )

      await expect(repository.updateStatus('proposal-1', 'draft'))
        .rejects.toThrow(ValidationError)
    })
  })

  describe('getStatisticsByCompany', () => {
    it('should calculate proposal statistics', async () => {
      // Mock count queries
      const counts = {
        total: 50,
        draft: 20,
        submitted: 15,
        won: 10,
        lost: 5
      }

      let queryIndex = 0
      const countOrder = ['total', 'draft', 'submitted', 'won', 'lost']

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((onFulfilled) => {
          const key = countOrder[queryIndex++]
          const response = { 
            data: null, 
            error: null, 
            count: counts[key as keyof typeof counts] 
          }
          return Promise.resolve(response).then(onFulfilled)
        })
      })) as any

      repository = new ProposalRepository(mockSupabase)
      const stats = await repository.getStatisticsByCompany('company-1')

      expect(stats).toEqual({
        total: 50,
        byStatus: {
          draft: 20,
          submitted: 15,
          won: 10,
          lost: 5
        },
        winRate: 40, // 10 won / (10 won + 15 submitted)
        avgTimeToSubmit: 0, // No data for time calculation in our mock
        avgProposalValue: 0
      })
    })

    it('should calculate average time to submit', async () => {
      const submittedProposals = [
        {
          created_at: '2024-01-01T00:00:00Z',
          actual_submission_date: '2024-01-05T00:00:00Z' // 4 days
        },
        {
          created_at: '2024-01-10T00:00:00Z',
          actual_submission_date: '2024-01-16T00:00:00Z' // 6 days
        }
      ]

      // Setup complex mock for multiple queries
      let queryCount = 0
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        then: jest.fn((onFulfilled) => {
          if (queryCount < 5) {
            // Count queries
            queryCount++
            return Promise.resolve({ data: null, error: null, count: 10 }).then(onFulfilled)
          } else if (queryCount === 5) {
            // Submitted proposals query
            queryCount++
            return Promise.resolve({ data: submittedProposals, error: null }).then(onFulfilled)
          } else {
            // Avg value query
            queryCount++
            return Promise.resolve({ data: [{ avg_value: 250000 }], error: null }).then(onFulfilled)
          }
        })
      })) as any

      repository = new ProposalRepository(mockSupabase)
      const stats = await repository.getStatisticsByCompany('company-1')

      expect(stats.avgTimeToSubmit).toBe(5) // Average of 4 and 6 days
    })

    it('should calculate average proposal value', async () => {
      // Setup mock for avg value query
      let queryCount = 0
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        then: jest.fn((onFulfilled) => {
          if (queryCount < 6) {
            queryCount++
            return Promise.resolve({ data: null, error: null, count: 10 }).then(onFulfilled)
          } else {
            return Promise.resolve({ 
              data: [{ avg_value: 350000 }], 
              error: null 
            }).then(onFulfilled)
          }
        })
      })) as any

      repository = new ProposalRepository(mockSupabase)
      const stats = await repository.getStatisticsByCompany('company-1')

      expect(stats.avgProposalValue).toBe(350000)
    })
  })

  describe('findExpiringProposals', () => {
    it('should find proposals with upcoming deadlines', async () => {
      const expiringProposals = mockProposals.filter(p => 
        p.status === 'draft' && p.submission_deadline
      )

      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { data: expiringProposals, error: null }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      const result = await repository.findExpiringProposals(7)

      expect(result.length).toBeGreaterThan(0)
      
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('status', 'draft')
      expect(query.not).toHaveBeenCalledWith('submission_deadline', 'is', null)
      expect(query.lte).toHaveBeenCalled() // deadline <= 7 days from now
      expect(query.gte).toHaveBeenCalled() // deadline >= now
    })

    it('should include company filter if provided', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { data: [], error: null }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      await repository.findExpiringProposals(7, 'company-1')

      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.eq).toHaveBeenCalledWith('company_id', 'company-1')
    })
  })

  describe('duplicateProposal', () => {
    it('should create a copy of proposal with sections', async () => {
      const originalProposal = {
        ...mockProposals[0],
        proposal_sections: mockProposalSections
      }

      const newProposalId = 'duplicate-proposal-id'

      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { data: originalProposal, error: null },
          'proposals.insert': { 
            data: { ...originalProposal, id: newProposalId, title: 'Copy of ' + originalProposal.title }, 
            error: null 
          },
          'proposal_sections.insert': { 
            data: mockProposalSections.map(s => ({ ...s, proposal_id: newProposalId })), 
            error: null 
          }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      const result = await repository.duplicateProposal('proposal-1', 'user-1')

      expect(result.id).toBe(newProposalId)
      expect(result.title).toBe('Copy of Medical Equipment Supply Proposal - VA Contract')
      
      // Check sections were copied
      const sectionsQuery = mockSupabase.from.mock.results[2]?.value
      expect(sectionsQuery.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            proposal_id: newProposalId,
            section_type: 'technical'
          })
        ])
      )
    })

    it('should reset status and dates for duplicate', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { data: mockProposals[0], error: null },
          'proposals.insert': { data: { id: 'dup-1' }, error: null }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      await repository.duplicateProposal('proposal-1', 'user-1')

      const insertQuery = mockSupabase.from.mock.results[1]?.value
      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'draft',
          actual_submission_date: null,
          user_id: 'user-1'
        })
      )
    })
  })

  describe('Performance', () => {
    it('should handle bulk operations efficiently', async () => {
      const bulkProposals = Array.from({ length: 100 }, (_, i) => 
        TestDataFactory.createProposal({
          id: `bulk-${i}`,
          company_id: 'company-1'
        })
      )

      mockSupabase = createMockSupabaseClient({
        responses: {
          'proposals.select': { 
            data: bulkProposals,
            error: null,
            count: 100
          }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      performanceTracker.mark('start')
      const result = await repository.findByCompany('company-1', {
        page: 1,
        pageSize: 100
      })
      performanceTracker.mark('end')

      expect(result.data).toHaveLength(100)
      
      const duration = performanceTracker.measure('bulk-fetch', 'start', 'end')
      expect(duration).toBeLessThan(500) // Should complete quickly
    })
  })

  describe('Error Handling', () => {
    it('should handle proposal not found', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'proposals.select': ErrorScenarios.postgresErrors.notFound
        }
      })
      repository = new ProposalRepository(mockSupabase)

      const result = await repository.findById('non-existent')
      expect(result).toBeNull()
    })

    it('should handle validation errors from validator', async () => {
      const { ProposalValidator } = require('@/lib/validation/services/proposal-validator')
      ProposalValidator.validateProposal.mockRejectedValueOnce(
        new ValidationError('Invalid proposal data', [
          { path: ['title'], message: 'Title is required' },
          { path: ['total_proposed_price'], message: 'Price must be positive' }
        ])
      )

      await expect(repository.create({} as any))
        .rejects.toThrow(ValidationError)
    })

    it('should handle concurrent modification errors', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'proposals.update': {
            code: '40001',
            message: 'could not serialize access due to concurrent update'
          }
        }
      })
      repository = new ProposalRepository(mockSupabase)

      await expect(repository.update('proposal-1', { title: 'Updated' }))
        .rejects.toThrow('Database operation failed')
    })
  })
})