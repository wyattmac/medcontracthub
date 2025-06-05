/**
 * React Query hooks for SAM.gov API
 * Following TanStack Query patterns from Context7 research
 */

'use client'

import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions
} from '@tanstack/react-query'
import { getSAMApiClient, SAMApiError } from './client'

// Create a lazy-loaded client instance
const getClient = () => getClient()
import { 
  ISAMOpportunity, 
  IOpportunityFilters, 
  IOpportunitySearchResult,
  ISAMOpportunitiesResponse 
} from './types'

// Query Keys
export const samQueryKeys = {
  all: ['sam'] as const,
  opportunities: () => [...samQueryKeys.all, 'opportunities'] as const,
  opportunitiesList: (filters: IOpportunityFilters) => 
    [...samQueryKeys.opportunities(), 'list', filters] as const,
  opportunityDetail: (noticeId: string) => 
    [...samQueryKeys.opportunities(), 'detail', noticeId] as const,
  opportunitiesByNAICS: (naicsCodes: string[]) => 
    [...samQueryKeys.opportunities(), 'naics', naicsCodes] as const,
  healthCheck: () => [...samQueryKeys.all, 'health'] as const,
} as const

// Custom hook options
interface UseOpportunitiesOptions {
  enabled?: boolean
  staleTime?: number
  cacheTime?: number
}

/**
 * Hook to search opportunities with filters
 */
export function useOpportunities(
  filters: IOpportunityFilters,
  options: UseOpportunitiesOptions = {}
) {
  return useQuery<IOpportunitySearchResult, SAMApiError>({
    queryKey: samQueryKeys.opportunitiesList(filters),
    queryFn: () => getClient().searchOpportunities(filters),
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 5 * 60 * 1000, // 5 minutes
    gcTime: options.cacheTime ?? 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.status === 401 || error.status === 403) {
        return false
      }
      // Retry up to 3 times for other errors
      return failureCount < 3
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  })
}

/**
 * Hook to get opportunity details by notice ID
 */
export function useOpportunityDetail(
  noticeId: string,
  options: UseOpportunitiesOptions = {}
) {
  return useQuery<ISAMOpportunity | null, SAMApiError>({
    queryKey: samQueryKeys.opportunityDetail(noticeId),
    queryFn: async () => {
      const response = await getClient().getOpportunityById(noticeId)
      return response.opportunitiesData?.[0] || null
    },
    enabled: (options.enabled ?? true) && !!noticeId,
    staleTime: options.staleTime ?? 15 * 60 * 1000, // 15 minutes
    gcTime: options.cacheTime ?? 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, error) => {
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        return false
      }
      return failureCount < 2
    }
  })
}

/**
 * Hook to get opportunities by company NAICS codes
 */
export function useOpportunitiesByNAICS(
  naicsCodes: string[],
  options: UseOpportunitiesOptions = {}
) {
  return useQuery<IOpportunitySearchResult, SAMApiError>({
    queryKey: samQueryKeys.opportunitiesByNAICS(naicsCodes),
    queryFn: () => getClient().getOpportunitiesByNAICS(naicsCodes),
    enabled: (options.enabled ?? true) && naicsCodes.length > 0,
    staleTime: options.staleTime ?? 10 * 60 * 1000, // 10 minutes
    gcTime: options.cacheTime ?? 20 * 60 * 1000, // 20 minutes
    retry: (failureCount, error) => {
      if (error.status === 401 || error.status === 403) {
        return false
      }
      return failureCount < 2
    }
  })
}

/**
 * Hook to check SAM API connectivity
 */
export function useSAMHealthCheck(options: UseOpportunitiesOptions = {}) {
  return useQuery<boolean, SAMApiError>({
    queryKey: samQueryKeys.healthCheck(),
    queryFn: () => getClient().healthCheck(),
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 2 * 60 * 1000, // 2 minutes
    gcTime: options.cacheTime ?? 5 * 60 * 1000, // 5 minutes
    retry: 1
  })
}

/**
 * Mutation hook for refreshing opportunity data
 */
export function useRefreshOpportunities() {
  const queryClient = useQueryClient()

  return useMutation<void, SAMApiError, IOpportunityFilters>({
    mutationFn: async (filters) => {
      // Invalidate and refetch opportunities with the given filters
      await queryClient.invalidateQueries({
        queryKey: samQueryKeys.opportunitiesList(filters)
      })
    },
    onSuccess: () => {
      // Optionally show success message
      console.log('Opportunities refreshed successfully')
    },
    onError: (error) => {
      console.error('Failed to refresh opportunities:', error)
    }
  })
}

/**
 * Mutation hook for prefetching opportunity details
 */
export function usePrefetchOpportunityDetail() {
  const queryClient = useQueryClient()

  return useMutation<void, SAMApiError, string>({
    mutationFn: async (noticeId) => {
      await queryClient.prefetchQuery({
        queryKey: samQueryKeys.opportunityDetail(noticeId),
        queryFn: async () => {
          const response = await getClient().getOpportunityById(noticeId)
          return response.opportunitiesData?.[0] || null
        },
        staleTime: 15 * 60 * 1000 // 15 minutes
      })
    }
  })
}

/**
 * Hook to get all cached opportunities data
 */
export function useCachedOpportunities() {
  const queryClient = useQueryClient()

  const getAllCachedOpportunities = () => {
    const cache = queryClient.getQueryCache()
    const opportunityQueries = cache.findAll({
      queryKey: samQueryKeys.opportunities()
    })

    const opportunities: ISAMOpportunity[] = []
    
    opportunityQueries.forEach(query => {
      const data = query.state.data as IOpportunitySearchResult | ISAMOpportunity | null
      
      if (data) {
        if ('opportunities' in data) {
          // It's an IOpportunitySearchResult
          opportunities.push(...data.opportunities)
        } else if ('noticeId' in data) {
          // It's a single ISAMOpportunity
          opportunities.push(data)
        }
      }
    })

    // Remove duplicates
    return opportunities.filter((opportunity, index, self) =>
      index === self.findIndex(o => o.noticeId === opportunity.noticeId)
    )
  }

  return {
    getCachedOpportunities: getAllCachedOpportunities,
    clearOpportunitiesCache: () => {
      queryClient.removeQueries({
        queryKey: samQueryKeys.opportunities()
      })
    }
  }
}

/**
 * Prefetch opportunities in the background
 */
export function usePrefetchOpportunities() {
  const queryClient = useQueryClient()

  const prefetchOpportunities = async (filters: IOpportunityFilters) => {
    await queryClient.prefetchQuery({
      queryKey: samQueryKeys.opportunitiesList(filters),
      queryFn: () => getClient().searchOpportunities(filters),
      staleTime: 5 * 60 * 1000 // 5 minutes
    })
  }

  return { prefetchOpportunities }
}