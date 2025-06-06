/**
 * Optimized SAM.gov Client for Maximum API Efficiency
 * Designed for hundreds of users with 1,000 daily API call limit
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getSAMQuotaManager } from './quota-manager'
import { getSAMCacheStrategy } from './cache-strategy'
import { apiLogger } from '@/lib/errors/logger'
import { ExternalServiceError, QuotaExceededError } from '@/lib/errors/types'
import crypto from 'crypto'

interface SAMAPIResponse<T = any> {
  data: T
  totalRecords?: number
  page?: number
  cached: boolean
  apiCallsUsed: number
}

interface OpportunitySearchParams {
  keyword?: string
  naicsCode?: string
  agency?: string
  state?: string
  postedFrom?: string
  postedTo?: string
  limit?: number
  offset?: number
}

export class OptimizedSAMClient {
  private quotaManager = getSAMQuotaManager()
  private cacheStrategy = getSAMCacheStrategy()
  private supabase = createServiceClient()

  constructor(private apiKey: string) {}

  /**
   * Search opportunities with aggressive caching
   * Database-first approach - only hits API when absolutely necessary
   */
  async searchOpportunities(
    params: OpportunitySearchParams,
    userId?: string
  ): Promise<SAMAPIResponse> {
    const searchHash = this.generateSearchHash(params)
    
    // Step 1: Try database first (fastest)
    const dbResults = await this.searchDatabase(params)
    if (dbResults.length > 0) {
      await this.recordAPIUsage('search', userId, {
        cached: true,
        source: 'database',
        resultCount: dbResults.length
      })
      
      return {
        data: dbResults,
        totalRecords: dbResults.length,
        cached: true,
        apiCallsUsed: 0
      }
    }

    // Step 2: Try search cache (second fastest)
    const cachedSearch = await this.getCachedSearch(searchHash)
    if (cachedSearch) {
      await this.recordAPIUsage('search', userId, {
        cached: true,
        source: 'search_cache',
        resultCount: cachedSearch.results.length
      })
      
      return {
        data: cachedSearch.results,
        totalRecords: cachedSearch.result_count,
        cached: true,
        apiCallsUsed: 0
      }
    }

    // Step 3: Make API call only if necessary
    return this.quotaManager.withQuotaCheck(
      'search',
      userId,
      async () => {
        const startTime = Date.now()
        const response = await this.callSAMAPI('/opportunities/v2/search', params)
        const responseTime = Date.now() - startTime

        // Store complete results in all cache layers
        await Promise.all([
          this.storeOpportunitiesInDatabase(response.opportunitiesData || []),
          this.storeCachedSearch(searchHash, params, response, responseTime),
          this.storeInMemoryCache(params, response)
        ])

        await this.recordAPIUsage('search', userId, {
          cached: false,
          source: 'sam_api',
          resultCount: response.opportunitiesData?.length || 0,
          responseTime
        })

        return {
          data: response.opportunitiesData || [],
          totalRecords: response.totalRecords || 0,
          cached: false,
          apiCallsUsed: 1
        }
      },
      { searchParams: params, responseTime: 0 }
    )
  }

  /**
   * Get opportunity details with comprehensive caching
   */
  async getOpportunityDetails(
    noticeId: string,
    userId?: string
  ): Promise<SAMAPIResponse> {
    // Step 1: Check database first
    const dbOpportunity = await this.getOpportunityFromDatabase(noticeId)
    if (dbOpportunity?.sam_raw_data && Object.keys(dbOpportunity.sam_raw_data).length > 0) {
      await this.recordAPIUsage('detail', userId, {
        cached: true,
        source: 'database',
        noticeId
      })
      
      return {
        data: dbOpportunity,
        cached: true,
        apiCallsUsed: 0
      }
    }

    // Step 2: Check detailed cache
    const cachedDetails = await this.getCachedOpportunityDetails(noticeId)
    if (cachedDetails) {
      await this.recordAPIUsage('detail', userId, {
        cached: true,
        source: 'detail_cache',
        noticeId
      })
      
      return {
        data: cachedDetails.full_details,
        cached: true,
        apiCallsUsed: 0
      }
    }

    // Step 3: Make API call for detailed information
    return this.quotaManager.withQuotaCheck(
      'detail',
      userId,
      async () => {
        const startTime = Date.now()
        const response = await this.callSAMAPI(`/opportunities/v2/${noticeId}`)
        const responseTime = Date.now() - startTime

        // Store complete details in all systems
        await Promise.all([
          this.updateOpportunityInDatabase(noticeId, response),
          this.storeCachedOpportunityDetails(noticeId, response, responseTime),
          this.storeDetailInMemoryCache(noticeId, response)
        ])

        await this.recordAPIUsage('detail', userId, {
          cached: false,
          source: 'sam_api',
          noticeId,
          responseTime
        })

        return {
          data: response,
          cached: false,
          apiCallsUsed: 1
        }
      },
      { noticeId, responseTime: 0 }
    )
  }

  /**
   * Get reference data (agencies, NAICS codes) with long-term caching
   */
  async getReferenceData(
    type: 'agencies' | 'naics' | 'set_asides',
    userId?: string
  ): Promise<SAMAPIResponse> {
    // Check reference cache (7-day TTL)
    const cachedRef = await this.getCachedReferenceData(type)
    if (cachedRef) {
      await this.recordAPIUsage('search', userId, {
        cached: true,
        source: 'reference_cache',
        referenceType: type
      })
      
      return {
        data: cachedRef.data,
        cached: true,
        apiCallsUsed: 0
      }
    }

    // Make API call for reference data
    return this.quotaManager.withQuotaCheck(
      'search',
      userId,
      async () => {
        const endpoint = this.getReferenceEndpoint(type)
        const response = await this.callSAMAPI(endpoint)

        // Store with 7-day expiration
        await this.storeCachedReferenceData(type, response)

        await this.recordAPIUsage('search', userId, {
          cached: false,
          source: 'sam_api',
          referenceType: type
        })

        return {
          data: response,
          cached: false,
          apiCallsUsed: 1
        }
      },
      { referenceType: type }
    )
  }

  /**
   * Batch sync for background population
   * Designed to maximize data capture per API call
   */
  async batchSync(
    dateRange: { from: string; to: string },
    options: {
      maxRecords?: number
      priorityNAICS?: string[]
      priorityAgencies?: string[]
    } = {}
  ): Promise<{ opportunitiesAdded: number; apiCallsUsed: number }> {
    const { maxRecords = 1000, priorityNAICS = [], priorityAgencies = [] } = options
    let totalAdded = 0
    let totalAPICalls = 0

    try {
      // Batch call for maximum efficiency
      const batchParams = {
        postedFrom: dateRange.from,
        postedTo: dateRange.to,
        limit: maxRecords
      }

      const response = await this.quotaManager.withQuotaCheck(
        'sync',
        undefined,
        async () => {
          const result = await this.callSAMAPI('/opportunities/v2/search', batchParams)
          totalAPICalls++
          return result
        },
        { syncBatch: true, dateRange }
      )

      if (response.opportunitiesData?.length > 0) {
        // Store ALL opportunities in database
        await this.storeOpportunitiesInDatabase(response.opportunitiesData)
        totalAdded = response.opportunitiesData.length

        // For priority opportunities, get detailed information
        const priorityOpps = response.opportunitiesData.filter(opp => 
          priorityNAICS.includes(opp.naicsCode) ||
          priorityAgencies.includes(opp.agency)
        )

        for (const opp of priorityOpps.slice(0, 10)) { // Limit to 10 detailed calls
          try {
            await this.getOpportunityDetails(opp.noticeId)
            totalAPICalls++
          } catch (error) {
            apiLogger.warn('Failed to get priority opportunity details', {
              noticeId: opp.noticeId,
              error: error.message
            })
          }
        }
      }

      await this.recordAPIUsage('sync', undefined, {
        opportunitiesAdded: totalAdded,
        apiCallsUsed: totalAPICalls,
        dateRange
      })

      return { opportunitiesAdded: totalAdded, apiCallsUsed: totalAPICalls }

    } catch (error) {
      apiLogger.error('Batch sync failed', error as Error, { dateRange })
      throw error
    }
  }

  // Private helper methods

  private generateSearchHash(params: OpportunitySearchParams): string {
    const normalizedParams = {
      ...params,
      // Remove pagination from hash to enable sharing
      limit: undefined,
      offset: undefined
    }
    return crypto
      .createHash('md5')
      .update(JSON.stringify(normalizedParams))
      .digest('hex')
  }

  private async searchDatabase(params: OpportunitySearchParams) {
    let query = this.supabase.from('opportunities').select('*')

    if (params.keyword) {
      query = query.or(`title.ilike.%${params.keyword}%,description.ilike.%${params.keyword}%`)
    }
    if (params.naicsCode) {
      query = query.eq('naics_code', params.naicsCode)
    }
    if (params.agency) {
      query = query.ilike('agency', `%${params.agency}%`)
    }
    if (params.state) {
      query = query.eq('place_of_performance_state', params.state)
    }
    if (params.postedFrom) {
      query = query.gte('posted_date', params.postedFrom)
    }
    if (params.postedTo) {
      query = query.lte('posted_date', params.postedTo)
    }

    query = query
      .eq('status', 'active')
      .order('posted_date', { ascending: false })
      .limit(params.limit || 100)

    const { data, error } = await query
    if (error) throw error
    
    return data || []
  }

  private async getCachedSearch(searchHash: string) {
    const { data } = await this.supabase
      .from('sam_search_cache')
      .select('*')
      .eq('search_hash', searchHash)
      .gt('expires_at', new Date().toISOString())
      .single()

    return data
  }

  private async storeCachedSearch(
    searchHash: string,
    params: OpportunitySearchParams,
    response: any,
    responseTime: number
  ) {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1) // 1-hour cache

    await this.supabase.from('sam_search_cache').upsert({
      search_hash: searchHash,
      search_params: params,
      result_count: response.opportunitiesData?.length || 0,
      results: response.opportunitiesData || [],
      api_response_time_ms: responseTime,
      expires_at: expiresAt.toISOString()
    })
  }

  private async storeOpportunitiesInDatabase(opportunities: any[]) {
    if (!opportunities?.length) return

    const dbOpportunities = opportunities.map(opp => ({
      notice_id: opp.noticeId,
      title: opp.title,
      description: opp.description,
      full_description: opp.fullDescription || opp.description,
      agency: opp.agency,
      sub_agency: opp.subAgency,
      office: opp.office,
      posted_date: opp.postedDate,
      response_deadline: opp.responseDeadLine,
      archive_date: opp.archiveDate,
      naics_code: opp.naicsCode,
      naics_description: opp.naicsDescription,
      place_of_performance_state: opp.placeOfPerformanceState,
      place_of_performance_city: opp.placeOfPerformanceCity,
      set_aside_type: opp.setAsideType,
      contract_type: opp.contractType,
      solicitation_number: opp.solicitationNumber,
      sam_url: opp.uiLink,
      sam_raw_data: opp, // Store complete SAM.gov response
      last_updated_sam: new Date().toISOString(),
      sync_version: 1
    }))

    // Use upsert to handle duplicates
    const { error } = await this.supabase
      .from('opportunities')
      .upsert(dbOpportunities, {
        onConflict: 'notice_id',
        ignoreDuplicates: false
      })

    if (error) {
      apiLogger.error('Failed to store opportunities in database', error)
      throw error
    }
  }

  private async getOpportunityFromDatabase(noticeId: string) {
    const { data } = await this.supabase
      .from('opportunities')
      .select('*')
      .eq('notice_id', noticeId)
      .single()

    return data
  }

  private async getCachedOpportunityDetails(noticeId: string) {
    const { data } = await this.supabase
      .from('sam_opportunity_details')
      .select('*')
      .eq('notice_id', noticeId)
      .gt('expires_at', new Date().toISOString())
      .single()

    return data
  }

  private async storeCachedOpportunityDetails(
    noticeId: string,
    response: any,
    responseTime: number
  ) {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24-hour cache

    await this.supabase.from('sam_opportunity_details').upsert({
      notice_id: noticeId,
      full_details: response,
      documents: response.attachments || [],
      amendments: response.amendments || [],
      questions_answers: response.questionsAnswers || [],
      last_sam_update: response.lastModified || new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    })
  }

  private async updateOpportunityInDatabase(noticeId: string, response: any) {
    await this.supabase
      .from('opportunities')
      .update({
        sam_raw_data: response,
        last_updated_sam: new Date().toISOString(),
        sync_version: 2 // Indicate this has detailed data
      })
      .eq('notice_id', noticeId)
  }

  private async getCachedReferenceData(type: string) {
    const { data } = await this.supabase
      .from('sam_reference_cache')
      .select('*')
      .eq('reference_type', type)
      .gt('expires_at', new Date().toISOString())
      .single()

    return data
  }

  private async storeCachedReferenceData(type: string, data: any) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7-day cache

    await this.supabase.from('sam_reference_cache').upsert({
      reference_type: type,
      data: data,
      expires_at: expiresAt.toISOString()
    })
  }

  private getReferenceEndpoint(type: string): string {
    switch (type) {
      case 'agencies': return '/references/agencies'
      case 'naics': return '/references/naics'
      case 'set_asides': return '/references/setasides'
      default: throw new Error(`Unknown reference type: ${type}`)
    }
  }

  private async storeInMemoryCache(params: any, response: any) {
    const cacheKey = this.generateSearchHash(params)
    await this.cacheStrategy.set(cacheKey, response, 'SEARCH_RESULTS', 3600)
  }

  private async storeDetailInMemoryCache(noticeId: string, response: any) {
    await this.cacheStrategy.set(noticeId, response, 'OPPORTUNITY_DETAIL', 86400)
  }

  private async callSAMAPI(endpoint: string, params?: any): Promise<any> {
    const url = new URL(`https://api.sam.gov/entity-information/v3${endpoint}`)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    url.searchParams.append('api_key', this.apiKey)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MedContractHub/1.0'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new ExternalServiceError(
        `SAM.gov API error: ${response.status} ${response.statusText}`,
        'SAM_API',
        { endpoint, params, response: errorText }
      )
    }

    return response.json()
  }

  private async recordAPIUsage(
    operation: string,
    userId?: string,
    metadata?: any
  ) {
    try {
      await this.supabase.from('sam_api_usage').insert({
        operation,
        user_id: userId,
        endpoint: metadata?.endpoint || operation,
        query_params: metadata?.searchParams || {},
        response_time_ms: metadata?.responseTime,
        success: true,
        cached: metadata?.cached || false,
        metadata: metadata || {}
      })
    } catch (error) {
      apiLogger.warn('Failed to record API usage', error as Error)
    }
  }
}

// Factory function
export function createOptimizedSAMClient(): OptimizedSAMClient {
  const apiKey = process.env.SAM_GOV_API_KEY
  if (!apiKey) {
    throw new Error('SAM_GOV_API_KEY environment variable is required')
  }
  
  return new OptimizedSAMClient(apiKey)
}