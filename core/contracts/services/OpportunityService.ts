/**
 * Opportunity Service
 * Core business logic for opportunities
 */

import { Opportunity, IOpportunity } from '../entities/Opportunity'
import { OpportunityRepository } from '../repositories/OpportunityRepository'
import { ICompanyProfile } from '@/core/users/entities/CompanyProfile'
import { CacheService } from '@/infrastructure/cache/CacheService'
import { QueryClient } from '@tanstack/react-query'

export interface IOpportunityFilters {
  searchQuery?: string
  naicsCodes?: string[]
  state?: string
  active?: boolean
  minValue?: number
  maxValue?: number
  deadlineFrom?: Date
  deadlineTo?: Date
  limit?: number
  offset?: number
}

export interface IOpportunitySearchResult {
  opportunities: Opportunity[]
  totalCount: number
  hasMore: boolean
  nextOffset?: number
}

export class OpportunityService {
  private repository: OpportunityRepository
  private cache: CacheService

  constructor(
    repository: OpportunityRepository,
    cache: CacheService
  ) {
    this.repository = repository
    this.cache = cache
  }

  /**
   * React Query keys for cache management
   */
  static queryKeys = {
    all: ['opportunities'] as const,
    lists: () => [...this.queryKeys.all, 'list'] as const,
    list: (filters: IOpportunityFilters) => 
      [...this.queryKeys.lists(), filters] as const,
    details: () => [...this.queryKeys.all, 'detail'] as const,
    detail: (id: string) => [...this.queryKeys.details(), id] as const,
    saved: (userId: string) => ['opportunities', 'saved', userId] as const,
  }

  /**
   * Search opportunities with filters
   */
  async searchOpportunities(
    filters: IOpportunityFilters,
    companyProfile?: ICompanyProfile
  ): Promise<IOpportunitySearchResult> {
    // Check cache first
    const cacheKey = this.cache.createKey('opportunities:search', filters)
    const cached = await this.cache.get<IOpportunitySearchResult>(cacheKey)
    
    if (cached) {
      return cached
    }

    // If no specific NAICS codes provided, use company's codes
    if (!filters.naicsCodes && companyProfile?.naicsCodes) {
      filters.naicsCodes = companyProfile.naicsCodes
    }

    // Fetch from repository
    const result = await this.repository.search(filters)

    // Calculate match scores if company profile provided
    if (companyProfile) {
      result.opportunities = result.opportunities.map(opp => {
        opp.matchScore = this.calculateMatchScore(opp, companyProfile)
        return opp
      })

      // Sort by match score
      result.opportunities.sort((a, b) => 
        (b.matchScore || 0) - (a.matchScore || 0)
      )
    }

    // Cache the result for 5 minutes
    await this.cache.set(cacheKey, result, 300)

    return result
  }

  /**
   * Get opportunity by ID
   */
  async getOpportunityById(id: string): Promise<Opportunity | null> {
    const cacheKey = this.cache.createKey('opportunities:detail', { id })
    const cached = await this.cache.get<Opportunity>(cacheKey)
    
    if (cached) {
      return cached
    }

    const opportunity = await this.repository.findById(id)
    
    if (opportunity) {
      await this.cache.set(cacheKey, opportunity, 600) // 10 minutes
    }

    return opportunity
  }

  /**
   * Calculate match score between opportunity and company
   */
  calculateMatchScore(
    opportunity: IOpportunity,
    companyProfile: ICompanyProfile
  ): number {
    let score = 0
    let factors = 0

    // NAICS code match (40% weight)
    if (opportunity.naicsCodes && companyProfile.naicsCodes) {
      const naicsMatch = opportunity.naicsCodes.some(code =>
        companyProfile.naicsCodes!.includes(code)
      )
      if (naicsMatch) {
        score += 0.4
      }
      factors++
    }

    // Set-aside match (20% weight)
    if (opportunity.setAsideTypes && companyProfile.certifications) {
      const setAsideMatch = opportunity.setAsideTypes.some(type =>
        this.matchesSetAside(type, companyProfile.certifications!)
      )
      if (setAsideMatch) {
        score += 0.2
      }
      factors++
    }

    // Location match (20% weight)
    if (opportunity.placeOfPerformance && companyProfile.locations) {
      const locationMatch = companyProfile.locations.some(loc =>
        loc.state === opportunity.placeOfPerformance!.state
      )
      if (locationMatch) {
        score += 0.2
      }
      factors++
    }

    // Value range match (20% weight)
    if (opportunity.valueAmount && companyProfile.contractCapacity) {
      const { min, max } = opportunity.valueAmount
      const capacity = companyProfile.contractCapacity
      
      if (min >= capacity.min && max <= capacity.max) {
        score += 0.2
      } else if (
        (min >= capacity.min && min <= capacity.max) ||
        (max >= capacity.min && max <= capacity.max)
      ) {
        score += 0.1
      }
      factors++
    }

    // Normalize score
    return factors > 0 ? score : 0.5 // Default 50% if no factors to compare
  }

  /**
   * Save opportunity for user
   */
  async saveOpportunity(
    opportunityId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    await this.repository.saveForUser(opportunityId, userId, notes)
    
    // Invalidate user's saved opportunities cache
    await this.cache.invalidate(
      this.cache.createKey('opportunities:saved', { userId })
    )
  }

  /**
   * Get saved opportunities for user
   */
  async getSavedOpportunities(userId: string): Promise<Opportunity[]> {
    const cacheKey = this.cache.createKey('opportunities:saved', { userId })
    const cached = await this.cache.get<Opportunity[]>(cacheKey)
    
    if (cached) {
      return cached
    }

    const opportunities = await this.repository.findSavedByUser(userId)
    
    await this.cache.set(cacheKey, opportunities, 300) // 5 minutes
    
    return opportunities
  }

  /**
   * Prefetch opportunities for server-side rendering
   */
  async prefetchOpportunities(
    queryClient: QueryClient,
    filters: IOpportunityFilters,
    companyProfile?: ICompanyProfile
  ): Promise<void> {
    await queryClient.prefetchQuery({
      queryKey: OpportunityService.queryKeys.list(filters),
      queryFn: () => this.searchOpportunities(filters, companyProfile),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  }

  /**
   * Check if set-aside type matches company certifications
   */
  private matchesSetAside(
    setAsideType: string,
    certifications: string[]
  ): boolean {
    const setAsideMap: Record<string, string[]> = {
      'SBA': ['8(a)', 'HUBZone', 'WOSB', 'EDWOSB'],
      'SDVOSB': ['SDVOSB', 'VOSB'],
      '8(a)': ['8(a)'],
      'HUBZone': ['HUBZone'],
      'WOSB': ['WOSB', 'EDWOSB'],
    }

    return certifications.some(cert =>
      setAsideMap[setAsideType]?.includes(cert) || false
    )
  }

  /**
   * Get opportunities expiring soon
   */
  async getExpiringOpportunities(
    userId: string,
    daysAhead: number = 7
  ): Promise<Opportunity[]> {
    const saved = await this.getSavedOpportunities(userId)
    
    return saved.filter(opp => {
      const daysUntil = opp.daysUntilDeadline()
      return daysUntil >= 0 && daysUntil <= daysAhead
    })
  }

  /**
   * Get opportunity statistics
   */
  async getOpportunityStats(companyProfile?: ICompanyProfile) {
    const cacheKey = this.cache.createKey('opportunities:stats', {
      companyId: companyProfile?.id
    })
    
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached

    const stats = await this.repository.getStats(companyProfile?.naicsCodes)
    
    await this.cache.set(cacheKey, stats, 3600) // 1 hour
    
    return stats
  }
}