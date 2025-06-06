/**
 * Component Integration Test: OpportunitiesList
 * Tests the complete opportunity listing functionality including filtering, pagination, and actions
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OpportunitiesList } from '@/components/dashboard/opportunities/opportunities-list'
import { createMockOpportunity } from '../../utils/api-test-helper'

// Mock the API client
jest.mock('@/lib/api/client', () => ({
  searchOpportunities: jest.fn(),
  saveOpportunity: jest.fn()
}))

// Mock components that have complex dependencies
jest.mock('@/components/dashboard/opportunities/save-opportunity-button', () => {
  return function MockSaveButton({ opportunityId, isSaved, onToggle }: any) {
    return (
      <button 
        data-testid={`save-button-${opportunityId}`}
        onClick={() => onToggle(!isSaved)}
      >
        {isSaved ? 'Unsave' : 'Save'}
      </button>
    )
  }
})

jest.mock('@/components/dashboard/opportunities/reminder-button', () => {
  return function MockReminderButton({ opportunityId }: any) {
    return (
      <button data-testid={`reminder-button-${opportunityId}`}>
        Set Reminder
      </button>
    )
  }
})

import { searchOpportunities, saveOpportunity } from '@/lib/api/client'

const mockSearchOpportunities = searchOpportunities as jest.MockedFunction<typeof searchOpportunities>
const mockSaveOpportunity = saveOpportunity as jest.MockedFunction<typeof saveOpportunity>

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('OpportunitiesList Integration', () => {
  const mockOpportunities = [
    createMockOpportunity({
      id: 'opp-1',
      title: 'Medical Equipment Procurement - Ventilators',
      matchScore: 95,
      isSaved: false,
      response_deadline: '2024-12-31T23:59:59Z'
    }),
    createMockOpportunity({
      id: 'opp-2',
      title: 'Surgical Instruments Supply Contract',
      matchScore: 88,
      isSaved: true,
      response_deadline: '2024-12-25T23:59:59Z'
    }),
    createMockOpportunity({
      id: 'opp-3',
      title: 'Hospital Furniture and Equipment',
      matchScore: 72,
      isSaved: false,
      response_deadline: '2024-12-20T23:59:59Z'
    })
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSearchOpportunities.mockResolvedValue({
      opportunities: mockOpportunities,
      totalCount: 3,
      hasMore: false,
      quotaStatus: {
        remaining: 500,
        total: 1000,
        warningThreshold: 200
      }
    })
    
    mockSaveOpportunity.mockResolvedValue({
      saved: true,
      message: 'Opportunity saved successfully'
    })
  })

  describe('Basic Rendering', () => {
    it('should render opportunities list with correct data', async () => {
      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      })

      // Check all opportunities are rendered
      expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      expect(screen.getByText('Surgical Instruments Supply Contract')).toBeInTheDocument()
      expect(screen.getByText('Hospital Furniture and Equipment')).toBeInTheDocument()

      // Check match scores are displayed
      expect(screen.getByText('95%')).toBeInTheDocument()
      expect(screen.getByText('88%')).toBeInTheDocument()
      expect(screen.getByText('72%')).toBeInTheDocument()
    })

    it('should display loading state initially', () => {
      // Delay the mock response
      mockSearchOpportunities.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          opportunities: mockOpportunities,
          totalCount: 3,
          hasMore: false,
          quotaStatus: { remaining: 500, total: 1000, warningThreshold: 200 }
        }), 100))
      )

      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      expect(screen.getByTestId('opportunities-loading')).toBeInTheDocument()
    })

    it('should handle empty state correctly', async () => {
      mockSearchOpportunities.mockResolvedValue({
        opportunities: [],
        totalCount: 0,
        hasMore: false,
        quotaStatus: { remaining: 500, total: 1000, warningThreshold: 200 }
      })

      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText(/no opportunities found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Filtering', () => {
    it('should filter opportunities by search query', async () => {
      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      })

      // Enter search query
      const searchInput = screen.getByPlaceholderText(/search opportunities/i)
      fireEvent.change(searchInput, { target: { value: 'surgical' } })

      // Wait for debounced search
      await waitFor(() => {
        expect(mockSearchOpportunities).toHaveBeenCalledWith(
          expect.objectContaining({
            q: 'surgical'
          })
        )
      }, { timeout: 2000 })
    })

    it('should filter by NAICS codes', async () => {
      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      })

      // Select NAICS filter
      const naicsSelect = screen.getByLabelText(/naics code/i)
      fireEvent.change(naicsSelect, { target: { value: '339112' } })

      await waitFor(() => {
        expect(mockSearchOpportunities).toHaveBeenCalledWith(
          expect.objectContaining({
            naics: '339112'
          })
        )
      })
    })

    it('should filter by state', async () => {
      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      })

      const stateSelect = screen.getByLabelText(/state/i)
      fireEvent.change(stateSelect, { target: { value: 'CA' } })

      await waitFor(() => {
        expect(mockSearchOpportunities).toHaveBeenCalledWith(
          expect.objectContaining({
            state: 'CA'
          })
        )
      })
    })

    it('should reset filters when clear button is clicked', async () => {
      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      })

      // Set some filters
      const searchInput = screen.getByPlaceholderText(/search opportunities/i)
      fireEvent.change(searchInput, { target: { value: 'medical' } })

      const clearButton = screen.getByText(/clear filters/i)
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(searchInput.value).toBe('')
        expect(mockSearchOpportunities).toHaveBeenCalledWith(
          expect.objectContaining({
            q: undefined
          })
        )
      })
    })
  })

  describe('Sorting and Pagination', () => {
    it('should handle pagination correctly', async () => {
      // Mock data with more results
      mockSearchOpportunities.mockResolvedValue({
        opportunities: mockOpportunities,
        totalCount: 50,
        hasMore: true,
        nextOffset: 25,
        quotaStatus: { remaining: 500, total: 1000, warningThreshold: 200 }
      })

      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      })

      // Check pagination controls are present
      expect(screen.getByText(/showing 1-3 of 50/i)).toBeInTheDocument()
      
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).toBeInTheDocument()
      expect(nextButton).not.toBeDisabled()

      // Click next page
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(mockSearchOpportunities).toHaveBeenCalledWith(
          expect.objectContaining({
            offset: 25
          })
        )
      })
    })

    it('should sort opportunities by match score by default', async () => {
      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      })

      // Check that opportunities are rendered in order of match score (highest first)
      const opportunityTitles = screen.getAllByTestId(/opportunity-title/i)
      expect(opportunityTitles[0]).toHaveTextContent('Medical Equipment Procurement - Ventilators') // 95%
      expect(opportunityTitles[1]).toHaveTextContent('Surgical Instruments Supply Contract') // 88%
      expect(opportunityTitles[2]).toHaveTextContent('Hospital Furniture and Equipment') // 72%
    })
  })

  describe('Save/Unsave Actions', () => {
    it('should save an opportunity when save button is clicked', async () => {
      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      })

      const saveButton = screen.getByTestId('save-button-opp-1')
      expect(saveButton).toHaveTextContent('Save')

      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockSaveOpportunity).toHaveBeenCalledWith('opp-1')
      })

      // Button should update to show saved state
      expect(saveButton).toHaveTextContent('Unsave')
    })

    it('should unsave an opportunity when unsave button is clicked', async () => {
      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Surgical Instruments Supply Contract')).toBeInTheDocument()
      })

      const unsaveButton = screen.getByTestId('save-button-opp-2')
      expect(unsaveButton).toHaveTextContent('Unsave') // Already saved

      fireEvent.click(unsaveButton)

      await waitFor(() => {
        expect(mockSaveOpportunity).toHaveBeenCalledWith('opp-2')
      })

      expect(unsaveButton).toHaveTextContent('Save')
    })
  })

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      mockSearchOpportunities.mockRejectedValue(new Error('API Error'))

      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText(/error loading opportunities/i)).toBeInTheDocument()
      })

      // Should show retry button
      const retryButton = screen.getByText(/try again/i)
      expect(retryButton).toBeInTheDocument()

      // Retry should work
      mockSearchOpportunities.mockResolvedValue({
        opportunities: mockOpportunities,
        totalCount: 3,
        hasMore: false,
        quotaStatus: { remaining: 500, total: 1000, warningThreshold: 200 }
      })

      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      })
    })

    it('should handle save operation errors gracefully', async () => {
      mockSaveOpportunity.mockRejectedValue(new Error('Save failed'))

      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Medical Equipment Procurement - Ventilators')).toBeInTheDocument()
      })

      const saveButton = screen.getByTestId('save-button-opp-1')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to save opportunity/i)).toBeInTheDocument()
      })
    })
  })

  describe('Performance Indicators', () => {
    it('should show quota warning when API quota is low', async () => {
      mockSearchOpportunities.mockResolvedValue({
        opportunities: mockOpportunities,
        totalCount: 3,
        hasMore: false,
        quotaStatus: {
          remaining: 50, // Low quota
          total: 1000,
          warningThreshold: 200
        }
      })

      render(
        <TestWrapper>
          <OpportunitiesList />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText(/api quota low/i)).toBeInTheDocument()
      })
    })

    it('should virtualize list for large datasets', async () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => 
        createMockOpportunity({ id: `opp-${i}`, title: `Opportunity ${i}` })
      )

      mockSearchOpportunities.mockResolvedValue({
        opportunities: largeDataset,
        totalCount: 1000,
        hasMore: false,
        quotaStatus: { remaining: 500, total: 1000, warningThreshold: 200 }
      })

      render(
        <TestWrapper>
          <OpportunitiesList enableVirtualization={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        // Should only render visible items (not all 1000)
        const renderedOpportunities = screen.getAllByTestId(/opportunity-item/i)
        expect(renderedOpportunities.length).toBeLessThan(100) // Much less than 1000
      })
    })
  })
})