/**
 * Saved Opportunities Container - Display and manage saved opportunities
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

interface ISavedOpportunitiesContainerProps {
  userId: string
}

export function SavedOpportunitiesContainer({ userId }: ISavedOpportunitiesContainerProps) {
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
    queryKey: ['saved-opportunities', filters],
    queryFn: async () => {
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
        throw new Error('Failed to fetch saved opportunities')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  })

  const handleRefresh = () => {
    refetch()
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load saved opportunities: {error?.message || 'Unknown error occurred'}
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

      {/* Main Content */}
      <div className="lg:col-span-3 space-y-6">
        {/* Header with results count and refresh */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              'Loading saved opportunities...'
            ) : (
              `${totalCount} saved opportunities`
            )}
          </div>
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

        {/* Opportunities List */}
        <SavedOpportunitiesList 
          opportunities={opportunities} 
          isLoading={isLoading}
          onUpdate={handleRefresh}
        />

        {/* Empty State */}
        {!isLoading && opportunities.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <div className="text-6xl">📌</div>
                <h3 className="text-lg font-medium">No saved opportunities</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You haven't saved any opportunities yet. Start by browsing available opportunities and bookmarking the ones you're interested in.
                </p>
                <Button asChild>
                  <a href="/dashboard/opportunities">
                    Browse Opportunities
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}