/**
 * SAM.gov API Client
 * Based on: https://open.gsa.gov/api/get-opportunities-public-api/
 */

import { 
  ISAMOpportunitiesResponse, 
  ISAMOpportunitiesParams, 
  ISAMApiConfig, 
  ISAMErrorResponse,
  IOpportunityFilters,
  IOpportunitySearchResult
} from './types'
import { getSAMQuotaManager, executeWithPriority, CallPriority } from './quota-manager'
import { apiCache } from '@/lib/utils/cache'

export class SAMApiClient {
  private config: ISAMApiConfig
  private baseHeaders: HeadersInit

  constructor(config: ISAMApiConfig) {
    this.config = {
      timeout: 30000,
      ...config
    }

    this.baseHeaders = {
      'X-Api-Key': this.config.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }

  /**
   * Fetch opportunities from SAM.gov API with quota management
   */
  async getOpportunities(
    params: ISAMOpportunitiesParams = {}, 
    userId?: string,
    priority: CallPriority = CallPriority.MEDIUM
  ): Promise<ISAMOpportunitiesResponse> {
    const searchParams = new URLSearchParams()
    
    // Set default parameters
    // SAM.gov v2 API requires postedFrom and postedTo
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    const defaultParams: ISAMOpportunitiesParams = {
      limit: 100,
      offset: 0,
      active: 'true',
      latest: 'true',
      postedFrom: params.postedFrom || `${(thirtyDaysAgo.getMonth() + 1).toString().padStart(2, '0')}/${thirtyDaysAgo.getDate().toString().padStart(2, '0')}/${thirtyDaysAgo.getFullYear()}`,
      postedTo: params.postedTo || `${(thirtyDaysFromNow.getMonth() + 1).toString().padStart(2, '0')}/${thirtyDaysFromNow.getDate().toString().padStart(2, '0')}/${thirtyDaysFromNow.getFullYear()}`,
      ...params
    }

    // Build query parameters
    Object.entries(defaultParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // SAM.gov API expects lowercase 'noticeid' not 'noticeId'
        const paramKey = key === 'noticeId' ? 'noticeid' : key
        searchParams.append(paramKey, String(value))
      }
    })

    const url = `${this.config.baseUrl}/opportunities/v2/search?${searchParams.toString()}`
    
    // Check cache first to avoid API calls
    const cacheKey = `sam_opportunities:${searchParams.toString()}`
    const cached = apiCache.get<ISAMOpportunitiesResponse>(cacheKey)
    if (cached) {
      return cached
    }

    // Execute with quota management
    return executeWithPriority(
      priority,
      'search',
      userId,
      async () => {
        return this.executeApiCall(url, cacheKey)
      },
      { params: Object.fromEntries(searchParams) }
    )
  }

  private async executeApiCall(url: string, cacheKey: string): Promise<ISAMOpportunitiesResponse> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch(url, {
        method: 'GET',
        headers: this.baseHeaders,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData: ISAMErrorResponse = await Promise.race([
          response.json(),
          new Promise<ISAMErrorResponse>((_, reject) => 
            setTimeout(() => reject(new Error('JSON parsing timeout')), 10000)
          )
        ]).catch(() => ({
          title: 'HTTP Error',
          detail: `Request failed with status ${response.status}`,
          status: response.status
        }))
        
        throw new SAMApiError(errorData.detail, errorData.status, errorData)
      }

      // Add timeout for JSON parsing
      const data: ISAMOpportunitiesResponse = await Promise.race([
        response.json(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('JSON parsing timeout')), 15000)
        )
      ])
      
      // Cache successful responses for 10 minutes
      apiCache.set(cacheKey, data, 600)
      
      return data

    } catch (error) {
      if (error instanceof SAMApiError) {
        throw error
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new SAMApiError('Request timeout', 408)
        }
        throw new SAMApiError(`Network error: ${error.message}`, 0)
      }
      
      throw new SAMApiError('Unknown error occurred', 0)
    }
  }

  /**
   * Search opportunities with simplified filters and quota management
   */
  async searchOpportunities(
    filters: IOpportunityFilters, 
    userId?: string,
    priority: CallPriority = CallPriority.HIGH
  ): Promise<IOpportunitySearchResult> {
    const params: ISAMOpportunitiesParams = {
      limit: filters.limit || 25,
      offset: filters.offset || 0
    }

    // Map filters to API parameters
    if (filters.searchQuery) {
      params.title = filters.searchQuery
    }
    
    if (filters.naicsCode) {
      params.naicsCode = filters.naicsCode
    }
    
    if (filters.typeOfSetAside) {
      params.typeOfSetAside = filters.typeOfSetAside
    }
    
    if (filters.responseDeadlineFrom) {
      params.responseDeadLineFrom = filters.responseDeadlineFrom
    }
    
    if (filters.responseDeadlineTo) {
      params.responseDeadLineTo = filters.responseDeadlineTo
    }
    
    if (filters.state) {
      params.state = filters.state
    }
    
    if (filters.active !== undefined) {
      params.active = filters.active ? 'true' : 'false'
    }

    const response = await this.getOpportunities(params, userId, priority)

    return {
      opportunities: response.opportunitiesData || [],
      totalCount: response.totalRecords || 0,
      hasMore: (response.offset || 0) + (response.limit || 0) < (response.totalRecords || 0),
      nextOffset: response.opportunitiesData?.length ? (response.offset || 0) + (response.limit || 0) : undefined
    }
  }

  /**
   * Get a specific opportunity by notice ID
   */
  async getOpportunityById(
    noticeId: string, 
    userId?: string,
    priority: CallPriority = CallPriority.CRITICAL
  ): Promise<ISAMOpportunitiesResponse> {
    return this.getOpportunities({ 
      noticeId,
      includeSections: 'opportunityDescription,pointOfContact,additionalInfoText,awardInformation'
    }, userId, priority)
  }

  /**
   * Get opportunities for specific NAICS codes (useful for matching company capabilities)
   */
  async getOpportunitiesByNAICS(
    naicsCodes: string[], 
    limit = 50, 
    userId?: string,
    priority: CallPriority = CallPriority.MEDIUM
  ): Promise<IOpportunitySearchResult> {
    // SAM.gov API doesn't support multiple NAICS codes in a single request
    // So we'll make multiple requests and combine results
    const allOpportunities = []
    let totalCount = 0

    for (const naicsCode of naicsCodes.slice(0, 3)) { // Limit to 3 NAICS codes to avoid rate limits
      try {
        const result = await this.searchOpportunities({
          naicsCode,
          active: true,
          limit: Math.ceil(limit / naicsCodes.length)
        }, userId, priority)
        
        allOpportunities.push(...result.opportunities)
        totalCount += result.totalCount
      } catch (error) {
        console.warn(`Failed to fetch opportunities for NAICS ${naicsCode}:`, error)
      }
    }

    // Remove duplicates based on noticeId
    const uniqueOpportunities = allOpportunities.filter((opportunity, index, self) =>
      index === self.findIndex(o => o.noticeId === opportunity.noticeId)
    )

    return {
      opportunities: uniqueOpportunities.slice(0, limit),
      totalCount,
      hasMore: uniqueOpportunities.length >= limit,
      nextOffset: undefined // Complex pagination not supported for multiple NAICS
    }
  }

  /**
   * Health check for API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getOpportunities({ limit: 1 }, undefined, CallPriority.CRITICAL)
      return true
    } catch (error) {
      console.error('SAM API health check failed:', error)
      return false
    }
  }
}

/**
 * Custom error class for SAM API errors
 */
export class SAMApiError extends Error {
  public readonly status: number
  public readonly details?: ISAMErrorResponse

  constructor(message: string, status: number, details?: ISAMErrorResponse) {
    super(message)
    this.name = 'SAMApiError'
    this.status = status
    this.details = details
  }
}

/**
 * Create a configured SAM API client instance
 */
export function createSAMApiClient(apiKey: string): SAMApiClient {
  if (!apiKey) {
    throw new Error('SAM.gov API key is required')
  }

  return new SAMApiClient({
    baseUrl: 'https://api.sam.gov',
    apiKey,
    timeout: 30000
  })
}

/**
 * Get default SAM API client instance (lazy initialization)
 */
let _samApiClient: SAMApiClient | null = null

export function getSAMApiClient(): SAMApiClient {
  if (!_samApiClient) {
    const apiKey = process.env.SAM_GOV_API_KEY
    if (!apiKey) {
      throw new Error('SAM_GOV_API_KEY environment variable is required')
    }
    _samApiClient = createSAMApiClient(apiKey)
  }
  return _samApiClient
}