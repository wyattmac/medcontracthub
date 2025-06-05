/**
 * Opportunities Feature Hooks
 * Custom React hooks for opportunity management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { OpportunityService } from '@/core/contracts/services/OpportunityService'
import { IOpportunityFilters } from '@/core/contracts/services/OpportunityService'
import { useAuth } from '@/shared/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { opportunityApi } from '../api/opportunityApi'

/**
 * Hook to search opportunities
 */
export function useOpportunities(filters: IOpportunityFilters) {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: OpportunityService.queryKeys.list(filters),
    queryFn: () => opportunityApi.searchOpportunities(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!user,
  })
}

/**
 * Hook to get opportunity details
 */
export function useOpportunity(id: string) {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: OpportunityService.queryKeys.detail(id),
    queryFn: () => opportunityApi.getOpportunityById(id),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!user && !!id,
  })
}

/**
 * Hook to get saved opportunities
 */
export function useSavedOpportunities() {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: OpportunityService.queryKeys.saved(user?.id || ''),
    queryFn: () => opportunityApi.getSavedOpportunities(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  })
}

/**
 * Hook to save/unsave opportunity
 */
export function useSaveOpportunity() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { toast } = useToast()
  
  return useMutation({
    mutationFn: ({ 
      opportunityId, 
      save, 
      notes 
    }: { 
      opportunityId: string
      save: boolean
      notes?: string 
    }) => {
      if (save) {
        return opportunityApi.saveOpportunity(opportunityId, notes)
      } else {
        return opportunityApi.unsaveOpportunity(opportunityId)
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: OpportunityService.queryKeys.saved(user?.id || '')
      })
      
      // Optimistically update the opportunity detail
      queryClient.setQueryData(
        OpportunityService.queryKeys.detail(variables.opportunityId),
        (old: any) => ({
          ...old,
          isSaved: variables.save
        })
      )
      
      toast({
        title: variables.save ? 'Opportunity saved' : 'Opportunity removed',
        description: variables.save 
          ? 'You can find it in your saved opportunities'
          : 'Removed from your saved opportunities',
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update opportunity',
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to prefetch opportunities
 */
export function usePrefetchOpportunities() {
  const queryClient = useQueryClient()
  
  return useCallback(
    (filters: IOpportunityFilters) => {
      return queryClient.prefetchQuery({
        queryKey: OpportunityService.queryKeys.list(filters),
        queryFn: () => opportunityApi.searchOpportunities(filters),
        staleTime: 5 * 60 * 1000,
      })
    },
    [queryClient]
  )
}

/**
 * Hook to get opportunity stats
 */
export function useOpportunityStats() {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: ['opportunities', 'stats'],
    queryFn: () => opportunityApi.getOpportunityStats(),
    staleTime: 60 * 60 * 1000, // 1 hour
    enabled: !!user,
  })
}

/**
 * Hook for real-time opportunity updates
 */
export function useOpportunitySubscription(
  onUpdate: (opportunity: any) => void
) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  // This would connect to a WebSocket or Server-Sent Events
  // For now, it's a placeholder for future real-time features
  
  const subscribe = useCallback(() => {
    if (!user) return
    
    // Example: Subscribe to opportunity updates
    const eventSource = new EventSource('/api/opportunities/subscribe')
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      // Update cache
      queryClient.setQueryData(
        OpportunityService.queryKeys.detail(data.id),
        data
      )
      
      // Call callback
      onUpdate(data)
    }
    
    return () => {
      eventSource.close()
    }
  }, [user, queryClient, onUpdate])
  
  // Return subscribe function for manual control
  return { subscribe }
}