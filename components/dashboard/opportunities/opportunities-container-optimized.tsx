/**
 * Optimized Opportunities Container
 * Target: <1 second load time
 * 
 * Key optimizations:
 * - Uses optimized API endpoint
 * - Aggressive caching with React Query
 * - Performance monitoring
 * - Progressive loading states
 * - Minimal re-renders
 */

'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { OpportunitiesList } from './opportunities-list'
import { VirtualizedOpportunitiesList } from './virtualized-opportunities-list'
import { OpportunityPagination } from './opportunity-pagination'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle, Grid, List, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BulkExportButton } from './bulk-export-button'
import { QuotaIndicator } from './quota-indicator'
import { Badge } from '@/components/ui/badge'

interface IOptimizedOpportunitiesContainerProps {
  searchParams?: {
    q?: string
    naics?: string
    agency?: string
    status?: string
    sort?: string
    page?: string
    min_value?: string
    max_value?: string
  }
}

export function OptimizedOpportunitiesContainer({ searchParams }: IOptimizedOpportunitiesContainerProps) {
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams?.page || '1'))
  const [useVirtualization, setUseVirtualization] = useState(false)
  const limit = 25

  // Build optimized query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    
    if (searchParams?.q) params.set('query', searchParams.q)
    if (searchParams?.naics) params.set('naics', searchParams.naics)
    if (searchParams?.agency) params.set('agency', searchParams.agency)
    if (searchParams?.status) params.set('status', searchParams.status)
    if (searchParams?.sort) params.set('sort', searchParams.sort)
    if (searchParams?.min_value) params.set('min_value', searchParams.min_value)
    if (searchParams?.max_value) params.set('max_value', searchParams.max_value)
    
    params.set('page', currentPage.toString())
    params.set('limit', limit.toString())
    
    return params.toString()
  }, [searchParams, currentPage, limit])

  // Optimized React Query configuration
  const {
    data: searchResult,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    isPlaceholderData,
    failureCount
  } = useQuery({
    queryKey: ['opportunities-optimized', queryParams],
    queryFn: async ({ signal }) => {
      const startTime = performance.now()
      
      const response = await fetch(`/api/opportunities/search-optimized?${queryParams}`, {
        signal,
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        if (response.status === 408 || response.status === 504) {
          throw new Error('Server timeout: Please try again in a moment')
        } else if (response.status === 429) {
          throw new Error('Too many requests: Please wait a moment before trying again')
        } else if (response.status >= 500) {
          throw new Error('Server error: Please try again later')
        } else {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`)
        }
      }

      const data = await response.json()
      
      // Log performance metrics
      const clientTime = performance.now() - startTime
      console.log('🚀 Performance Metrics:', {
        client_total: `${Math.round(clientTime)}ms`,
        server_total: `${data.performance?.total_time || 'unknown'}ms`,
        opportunities_count: data.opportunities?.length || 0,
        total_opportunities: data.pagination?.total || 0
      })
      
      return data
    },
    // Aggressive caching for performance
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    placeholderData: keepPreviousData, // Show previous data while loading
    // Smart retry logic
    retry: (failureCount, error) => {
      if (error?.message?.includes('timeout') || 
          error?.message?.includes('Network error')) {
        return failureCount < 2
      }
      return failureCount < 1
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Enable network mode for better offline handling
    networkMode: 'offlineFirst'
  })

  // Memoized handlers to prevent unnecessary re-renders
  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    // Update URL without navigation
    const url = new URL(window.location.href)
    url.searchParams.set('page', page.toString())
    window.history.replaceState({}, '', url.toString())
  }, [])

  const handleVirtualizationToggle = useCallback(() => {
    setUseVirtualization(!useVirtualization)
  }, [useVirtualization])

  // Extract data with fallbacks
  const opportunities = searchResult?.opportunities || []
  const pagination = searchResult?.pagination || { total: 0, pages: 0, has_more: false }
  const performance_metrics = searchResult?.performance
  const userNaicsCount = searchResult?.user_naics || 0

  // Auto-enable virtualization for large datasets
  const shouldUseVirtualization = useMemo(() => {
    return useVirtualization || pagination.total > 100
  }, [useVirtualization, pagination.total])

  // Performance indicator
  const isHighPerformance = performance_metrics && performance_metrics.total_time < 1000
  const performanceColor = performance_metrics?.total_time < 500 ? 'bg-green-100 text-green-700' :
                           performance_metrics?.total_time < 1000 ? 'bg-yellow-100 text-yellow-700' :
                           'bg-red-100 text-red-700'

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load opportunities: {error?.message || 'Unknown error occurred'}
              {failureCount > 0 && (
                <span className="block mt-2 text-sm">
                  Attempted {failureCount} time(s). Check your internet connection.
                </span>
              )}
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
    <div className="space-y-4">
      {/* Performance & Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {isLoading && !isPlaceholderData ? (
              'Loading opportunities...'
            ) : (
              <>
                {`${pagination.total.toLocaleString()} opportunities found`}
                {userNaicsCount > 0 && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {userNaicsCount} NAICS codes
                  </span>
                )}
              </>
            )}
          </div>

          {/* Performance indicator */}
          {performance_metrics && (
            <Badge variant="outline" className={performanceColor}>
              <Zap className="h-3 w-3 mr-1" />
              {performance_metrics.total_time}ms
              {isHighPerformance && " ⚡"}
            </Badge>
          )}

          {/* Loading indicator for background updates */}
          {isFetching && isPlaceholderData && (
            <Badge variant="outline" className="animate-pulse">
              Updating...
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Export Button */}
          <BulkExportButton
            filters={searchParams || {}}
            totalCount={pagination.total}
            onExport={(type, options) => {
              console.log(`Exported ${type} with options:`, options)
            }}
          />
          
          {/* Virtualization toggle */}
          <Button
            onClick={handleVirtualizationToggle}
            variant={shouldUseVirtualization ? "default" : "outline"}
            size="sm"
            title={shouldUseVirtualization ? "Switch to standard list" : "Enable virtual scrolling"}
            disabled={isLoading && !isPlaceholderData}
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
      <div className={`transition-opacity duration-200 ${isLoading && !isPlaceholderData ? 'opacity-50' : 'opacity-100'}`}>
        {shouldUseVirtualization ? (
          <VirtualizedOpportunitiesList 
            opportunities={opportunities} 
            isLoading={isLoading && !isPlaceholderData}
            height={600}
          />
        ) : (
          <OpportunitiesList 
            opportunities={opportunities} 
            isLoading={isLoading && !isPlaceholderData}
          />
        )}
      </div>

      {/* Pagination */}
      {pagination.total > limit && (
        <OpportunityPagination
          currentPage={currentPage}
          totalCount={pagination.total}
          pageSize={limit}
          onPageChange={handlePageChange}
          disabled={isLoading && !isPlaceholderData}
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

      {/* Performance debug info (development only) */}
      {process.env.NODE_ENV === 'development' && performance_metrics && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Performance Details</summary>
          <pre className="mt-2 p-2 bg-muted rounded">
            {JSON.stringify(performance_metrics, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}