/**
 * Opportunity API Client
 * Handles all API calls for opportunities feature
 */

import { IOpportunityFilters, IOpportunitySearchResult } from '@/core/contracts/services/OpportunityService'
import { Opportunity } from '@/core/contracts/entities/Opportunity'

class OpportunityApi {
  private baseUrl = '/api/opportunities'

  /**
   * Search opportunities
   */
  async searchOpportunities(filters: IOpportunityFilters): Promise<IOpportunitySearchResult> {
    const params = new URLSearchParams()
    
    if (filters.searchQuery) params.set('q', filters.searchQuery)
    if (filters.naicsCodes?.length) params.set('naics', filters.naicsCodes.join(','))
    if (filters.state) params.set('state', filters.state)
    if (filters.active !== undefined) params.set('active', String(filters.active))
    if (filters.minValue) params.set('minValue', String(filters.minValue))
    if (filters.maxValue) params.set('maxValue', String(filters.maxValue))
    if (filters.deadlineFrom) params.set('deadlineFrom', filters.deadlineFrom.toISOString())
    if (filters.deadlineTo) params.set('deadlineTo', filters.deadlineTo.toISOString())
    if (filters.limit) params.set('limit', String(filters.limit))
    if (filters.offset) params.set('offset', String(filters.offset))

    const response = await fetch(`${this.baseUrl}/search?${params}`)
    
    if (!response.ok) {
      throw new Error('Failed to search opportunities')
    }

    const data = await response.json()
    
    return {
      opportunities: data.opportunities.map((opp: any) => 
        Opportunity.fromDatabase(opp)
      ),
      totalCount: data.totalCount,
      hasMore: data.hasMore,
      nextOffset: data.nextOffset
    }
  }

  /**
   * Get opportunity by ID
   */
  async getOpportunityById(id: string): Promise<Opportunity> {
    const response = await fetch(`${this.baseUrl}/${id}`)
    
    if (!response.ok) {
      throw new Error('Failed to get opportunity')
    }

    const data = await response.json()
    return Opportunity.fromDatabase(data)
  }

  /**
   * Get saved opportunities
   */
  async getSavedOpportunities(): Promise<Opportunity[]> {
    const response = await fetch(`${this.baseUrl}/saved`)
    
    if (!response.ok) {
      throw new Error('Failed to get saved opportunities')
    }

    const data = await response.json()
    return data.opportunities.map((opp: any) => 
      Opportunity.fromDatabase(opp)
    )
  }

  /**
   * Save opportunity
   */
  async saveOpportunity(opportunityId: string, notes?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ opportunityId, notes }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to save opportunity')
    }
  }

  /**
   * Unsave opportunity
   */
  async unsaveOpportunity(opportunityId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/save`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ opportunityId }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to unsave opportunity')
    }
  }

  /**
   * Get opportunity statistics
   */
  async getOpportunityStats() {
    const response = await fetch(`${this.baseUrl}/stats`)
    
    if (!response.ok) {
      throw new Error('Failed to get opportunity stats')
    }

    return response.json()
  }

  /**
   * Sync opportunities from SAM.gov
   */
  async syncOpportunities(naicsCodes?: string[]): Promise<{
    inserted: number
    updated: number
    total: number
  }> {
    const response = await fetch(`${this.baseUrl}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ naicsCodes }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to sync opportunities')
    }

    return response.json()
  }
}

export const opportunityApi = new OpportunityApi()