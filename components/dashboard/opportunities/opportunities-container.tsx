/**
 * Opportunities Container - Main container with React Query integration
 */

'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OpportunitiesList } from './opportunities-list'
import { VirtualizedOpportunitiesList } from './virtualized-opportunities-list'
import { OpportunityPagination } from './opportunity-pagination'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle, Grid, List } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BulkExportButton } from './bulk-export-button'

interface IOpportunitiesContainerProps {
  searchParams?: {
    q?: string
    naics?: string
    state?: string
    status?: string
    deadline_from?: string
    deadline_to?: string
    page?: string
  }
}

export function OpportunitiesContainer({ searchParams }: IOpportunitiesContainerProps) {
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams?.page || '1'))
  const [useVirtualization, setUseVirtualization] = useState(false)
  const limit = 25
  const offset = (currentPage - 1) * limit

  // Build filters from search params
  const filters = {
    searchQuery: searchParams?.q,
    naicsCodes: searchParams?.naics?.split(',').filter(Boolean),
    state: searchParams?.state,
    responseDeadlineFrom: searchParams?.deadline_from,
    responseDeadlineTo: searchParams?.deadline_to,
    active: searchParams?.status !== 'expired' && searchParams?.status !== 'awarded',
    limit,
    offset
  }

  // Use a custom query to call our API endpoint
  const {
    data: searchResult,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['opportunities', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      
      if (filters.searchQuery) params.set('q', filters.searchQuery)
      if (filters.naicsCodes?.length) params.set('naics', filters.naicsCodes.join(','))
      if (filters.state) params.set('state', filters.state)
      if (filters.responseDeadlineFrom) params.set('deadline_from', filters.responseDeadlineFrom)
      if (filters.responseDeadlineTo) params.set('deadline_to', filters.responseDeadlineTo)
      params.set('limit', filters.limit.toString())
      params.set('offset', filters.offset.toString())
      
      const response = await fetch(`/api/opportunities/search?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch opportunities')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  })

  const handleRefresh = () => {
    refetch()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Update URL without navigation
    const url = new URL(window.location.href)
    url.searchParams.set('page', page.toString())
    window.history.replaceState({}, '', url.toString())
  }

  const opportunities = searchResult?.opportunities || []
  const totalCount = searchResult?.totalCount || 0
  const hasMore = searchResult?.hasMore || false

  // Auto-enable virtualization for large datasets
  const shouldUseVirtualization = useMemo(() => {
    return useVirtualization || totalCount > 100
  }, [useVirtualization, totalCount])

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load opportunities: {error?.message || 'Unknown error occurred'}
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

  return (
    <div className="space-y-6">
      {/* Header with results count and controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            'Loading opportunities...'
          ) : (
            <>
              {`${totalCount.toLocaleString()} opportunities found`}
              {shouldUseVirtualization && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  Virtual scrolling enabled
                </span>
              )}
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Export Button */}
          <BulkExportButton
            filters={filters}
            totalCount={totalCount}
            onExport={(type, options) => {
              console.log(`Exported ${type} with options:`, options)
            }}
          />
          
          {/* Virtualization toggle */}
          <Button
            onClick={() => setUseVirtualization(!useVirtualization)}
            variant={shouldUseVirtualization ? "default" : "outline"}
            size="sm"
            title={shouldUseVirtualization ? "Switch to standard list" : "Enable virtual scrolling"}
          >
            {shouldUseVirtualization ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          
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
      </div>

      {/* Opportunities List */}
      {shouldUseVirtualization ? (
        <VirtualizedOpportunitiesList 
          opportunities={opportunities} 
          isLoading={isLoading}
          height={600}
        />
      ) : (
        <OpportunitiesList 
          opportunities={opportunities} 
          isLoading={isLoading}
        />
      )}

      {/* Pagination */}
      {!isLoading && totalCount > limit && (
        <OpportunityPagination
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={limit}
          onPageChange={handlePageChange}
        />
      )}

      {/* Empty State */}
      {!isLoading && opportunities.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="space-y-4">
              <div className="text-6xl">🔍</div>
              <h3 className="text-lg font-medium">No opportunities found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Try adjusting your search criteria or filters to find relevant contract opportunities.
              </p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Results
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}