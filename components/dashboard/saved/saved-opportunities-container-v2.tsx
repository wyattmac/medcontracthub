/**
 * Saved Opportunities Container V2 - Production Ready
 * Works in both development (localStorage) and production (Supabase)
 */

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SavedOpportunitiesList } from './saved-opportunities-list'
import { SavedOpportunitiesFilters } from './saved-opportunities-filters'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { mockSavedOpportunitiesStore } from '@/lib/mock/saved-opportunities-store'

export function SavedOpportunitiesContainer() {
  const { user, isDevelopment, loading: authLoading } = useAuth()
  const [filters, setFilters] = useState({
    isPursuing: undefined as boolean | undefined,
    hasReminder: undefined as boolean | undefined,
    tags: [] as string[],
    sortBy: 'deadline' as 'deadline' | 'saved_date' | 'match_score'
  })

  // Fetch saved opportunities
  const {
    data: savedOpportunities,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['saved-opportunities', user?.id, filters, isDevelopment],
    enabled: !!user?.id && !authLoading,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      if (isDevelopment && typeof window !== 'undefined') {
        // Development: Get from localStorage
        const savedOpps = mockSavedOpportunitiesStore.getAll(user.id)
        
        // Apply filters
        let filtered = savedOpps
        
        if (filters.isPursuing !== undefined) {
          filtered = filtered.filter(item => item.is_pursuing === filters.isPursuing)
        }
        
        if (filters.hasReminder !== undefined) {
          filtered = filtered.filter(item => 
            filters.hasReminder ? item.reminder_date !== null : item.reminder_date === null
          )
        }
        
        if (filters.tags.length > 0) {
          filtered = filtered.filter(item =>
            filters.tags.some(tag => item.tags.includes(tag))
          )
        }
        
        // Sort
        if (filters.sortBy === 'saved_date') {
          filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        } else if (filters.sortBy === 'deadline' && filtered.length > 0) {
          filtered.sort((a, b) => {
            const aDeadline = a.opportunity?.response_deadline
            const bDeadline = b.opportunity?.response_deadline
            if (!aDeadline) return 1
            if (!bDeadline) return -1
            return new Date(aDeadline).getTime() - new Date(bDeadline).getTime()
          })
        }
        
        // Transform to match expected format
        const transformed = filtered.map(item => ({
          ...item,
          opportunities: item.opportunity
        }))
        
        return {
          opportunities: transformed,
          totalCount: transformed.length,
          pagination: {
            offset: 0,
            limit: 25,
            total: transformed.length,
            hasMore: false
          }
        }
      } else {
        // Production: Use real API
        const params = new URLSearchParams()
        
        if (filters.isPursuing !== undefined) {
          params.set('is_pursuing', filters.isPursuing.toString())
        }
        if (filters.hasReminder !== undefined) {
          params.set('has_reminder', filters.hasReminder.toString())
        }
        if (filters.tags.length > 0) {
          params.set('tags', filters.tags.join(','))
        }
        params.set('sort_by', filters.sortBy)
        
        const response = await fetch(`/api/opportunities/saved?${params.toString()}`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch saved opportunities: ${response.status}`)
        }
        
        return response.json()
      }
    },
    staleTime: isDevelopment ? 0 : 5 * 60 * 1000, // No caching in dev, 5 min in prod
    gcTime: 10 * 60 * 1000
  })

  const handleRefresh = () => {
    refetch()
  }

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please log in to view your saved opportunities
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error?.message || 'Failed to load saved opportunities'}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            className="mt-4"
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const opportunities = savedOpportunities?.opportunities || []
  const totalCount = savedOpportunities?.totalCount || 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Filters Sidebar */}
      <div className="lg:col-span-1">
        <SavedOpportunitiesFilters 
          filters={filters}
          onFiltersChange={setFilters}
          isLoading={isLoading}
        />
      </div>

      {/* Opportunities List */}
      <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isLoading ? (
              'Loading...'
            ) : (
              `${totalCount} Saved ${totalCount === 1 ? 'Opportunity' : 'Opportunities'}`
            )}
          </h2>
          
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <SavedOpportunitiesList 
          opportunities={opportunities}
          isLoading={isLoading}
          onUpdate={handleRefresh}
        />
      </div>
    </div>
  )
}

// Helper for Loader2 icon
import { Loader2 } from 'lucide-react'