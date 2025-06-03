import { ExternalAPIError, ValidationError, RateLimitError } from '@/lib/errors/types'
import { apiLogger } from '@/lib/errors/logger'

// Brave Search API types
export interface BraveSearchConfig {
  apiKey?: string
  baseUrl?: string
  timeout?: number
}

export interface BraveWebSearchParams {
  q: string // Query
  count?: number // Number of results (1-20, default 10)
  offset?: number // Offset for pagination (max 9)
  country?: string // Country code (e.g., 'US')
  search_lang?: string // Language code (e.g., 'en')
  ui_lang?: string // UI language
  safesearch?: 'off' | 'moderate' | 'strict'
  freshness?: string // Time range: 'pd' (past day), 'pw' (past week), 'pm' (past month), 'py' (past year)
  text_decorations?: boolean // Include bold/italic decorations
  spellcheck?: boolean // Include spell check suggestions
  goggles_id?: string // Custom ranking profile
  units?: 'metric' | 'imperial'
  extra_snippets?: boolean // Include extra snippets
  result_filter?: string // Comma-separated list of result types to include
}

export interface BraveWebSearchResult {
  type: 'web' | 'news' | 'video' | 'location' | 'faq' | 'infobox' | 'discussions'
  title: string
  url: string
  description?: string
  age?: string
  page_age?: string
  meta_url?: {
    scheme?: string
    netloc?: string
    hostname?: string
    favicon?: string
    path?: string
  }
  thumbnail?: {
    src: string
    height?: number
    width?: number
  }
  extra_snippets?: string[]
  deep_results?: {
    news?: any[]
    buttons?: any[]
    recent?: any[]
  }
}

export interface BraveSearchResponse {
  type: 'search'
  query: {
    original: string
    altered?: string
    show_strict_warning?: boolean
    is_navigational?: boolean
    is_geolocal?: boolean
    local_decision?: string
    local_locations_idx?: number
    is_trending?: boolean
    is_news_breaking?: boolean
    ask_for_location?: boolean
    language?: string
    spellcheck_off?: boolean
    country?: string
    bad_results?: boolean
    should_fallback?: boolean
    lat?: string
    long?: string
    postal_code?: string
    city?: string
    state?: string
    header_country?: string
    more_results_available?: boolean
    custom_location_label?: string
    reddit_cluster?: string
  }
  mixed?: {
    type: string
    main?: BraveWebSearchResult[]
    top?: BraveWebSearchResult[]
    side?: BraveWebSearchResult[]
  }
  web?: {
    type: 'search'
    results: BraveWebSearchResult[]
    family_friendly?: boolean
  }
  news?: {
    type: 'news'
    results: any[]
  }
  videos?: {
    type: 'videos'
    results: any[]
  }
  locations?: {
    type: 'locations'
    results: any[]
  }
  faq?: {
    type: 'faq'
    results: any[]
  }
  infobox?: any
  discussions?: {
    type: 'discussions'
    results: any[]
  }
}

/**
 * Client for interacting with the Brave Search API
 * @see https://brave.com/search/api/
 */
export class BraveSearchClient {
  private config: BraveSearchConfig
  private headers: HeadersInit | null = null

  constructor(config: BraveSearchConfig = {}) {
    this.config = {
      baseUrl: 'https://api.search.brave.com/res/v1',
      timeout: 30000,
      ...config
    }
  }

  /**
   * Get initialized headers with API key
   */
  private getHeaders(): HeadersInit {
    if (!this.headers) {
      const apiKey = this.config.apiKey || process.env.BRAVE_SEARCH_API_KEY

      if (!apiKey) {
        throw new ValidationError('BRAVE_SEARCH_API_KEY is not configured')
      }

      this.headers = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    }

    return this.headers
  }

  /**
   * Search the web using Brave Search
   */
  async webSearch(params: BraveWebSearchParams): Promise<BraveSearchResponse> {
    const startTime = Date.now()

    try {
      apiLogger.info('Brave Search API request', {
        query: params.q,
        count: params.count,
        offset: params.offset
      })

      // Validate required parameters
      if (!params.q || params.q.trim().length === 0) {
        throw new ValidationError('Search query is required')
      }

      // Build query parameters
      const queryParams = new URLSearchParams()
      queryParams.append('q', params.q)

      if (params.count !== undefined) {
        queryParams.append('count', Math.min(Math.max(params.count, 1), 20).toString())
      }
      if (params.offset !== undefined) {
        queryParams.append('offset', Math.min(Math.max(params.offset, 0), 9).toString())
      }
      if (params.country) queryParams.append('country', params.country)
      if (params.search_lang) queryParams.append('search_lang', params.search_lang)
      if (params.ui_lang) queryParams.append('ui_lang', params.ui_lang)
      if (params.safesearch) queryParams.append('safesearch', params.safesearch)
      if (params.freshness) queryParams.append('freshness', params.freshness)
      if (params.text_decorations !== undefined) {
        queryParams.append('text_decorations', params.text_decorations.toString())
      }
      if (params.spellcheck !== undefined) {
        queryParams.append('spellcheck', params.spellcheck.toString())
      }
      if (params.goggles_id) queryParams.append('goggles_id', params.goggles_id)
      if (params.units) queryParams.append('units', params.units)
      if (params.extra_snippets !== undefined) {
        queryParams.append('extra_snippets', params.extra_snippets.toString())
      }
      if (params.result_filter) queryParams.append('result_filter', params.result_filter)

      const url = `${this.config.baseUrl}/web/search?${queryParams.toString()}`

      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout!)

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: this.getHeaders(),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After')
            apiLogger.warn('Brave Search API rate limit hit', {
              retryAfter,
              status: response.status
            })
            throw new RateLimitError('Brave Search API rate limit exceeded')
          }

          if (response.status === 401) {
            throw new ValidationError('Invalid Brave Search API key')
          }

          const errorText = await response.text()
          apiLogger.error('Brave Search API error', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          })

          throw new ExternalAPIError(
            'Brave Search',
            `API request failed: ${response.status} ${response.statusText}`
          )
        }

        const data = await response.json() as BraveSearchResponse

        const duration = Date.now() - startTime
        apiLogger.info('Brave Search API response', {
          query: params.q,
          resultsCount: data.web?.results?.length || 0,
          duration
        })

        return data
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      const duration = Date.now() - startTime

      if (error instanceof ValidationError || error instanceof RateLimitError) {
        throw error
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          apiLogger.error('Brave Search API timeout', {
            query: params.q,
            duration,
            timeout: this.config.timeout
          })
          throw new ExternalAPIError('Brave Search', 'Request timeout')
        }

        apiLogger.error('Brave Search API error', {
          query: params.q,
          duration,
          error: error.message,
          stack: error.stack
        })

        throw new ExternalAPIError(
          'Brave Search',
          `Search failed: ${error.message}`
        )
      }

      throw new ExternalAPIError('Brave Search', 'Unknown error occurred')
    }
  }

  /**
   * Search for medical suppliers and distributors
   */
  async searchMedicalSuppliers(
    query: string,
    options: Partial<BraveWebSearchParams> = {}
  ): Promise<BraveWebSearchResult[]> {
    // Enhance query for medical supplier searches
    const enhancedQuery = `${query} medical supplier distributor wholesale`

    const response = await this.webSearch({
      q: enhancedQuery,
      count: 20,
      country: 'US',
      search_lang: 'en',
      safesearch: 'moderate',
      ...options
    })

    // Extract and filter web results
    const webResults = response.web?.results || []
    const mixedResults = response.mixed?.main || []

    // Combine and deduplicate results
    const allResults = [...webResults, ...mixedResults]
    const uniqueResults = Array.from(
      new Map(allResults.map(r => [r.url, r])).values()
    )

    // Filter for relevant medical supplier results
    return uniqueResults.filter(result => {
      const text = `${result.title} ${result.description}`.toLowerCase()
      return (
        text.includes('medical') ||
        text.includes('supplier') ||
        text.includes('distributor') ||
        text.includes('wholesale') ||
        text.includes('healthcare')
      )
    })
  }
}

// Export singleton instance
export const braveSearchClient = new BraveSearchClient()

// Export factory function for custom instances
export function createBraveSearchClient(apiKey: string): BraveSearchClient {
  return new BraveSearchClient({ apiKey })
}