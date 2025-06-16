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
import { BulkExportButtonDynamic } from './bulk-export-button-dynamic'
import { QuotaIndicator } from './quota-indicator'
import { PerformanceIndicator } from './performance-indicator'

interface IOpportunitiesContainerProps {
  searchParams?: {
    q?: string
    naics?: string
    state?: string
    status?: string
    set_aside?: string
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
    set_aside: searchParams?.set_aside,
    responseDeadlineFrom: searchParams?.deadline_from,
    responseDeadlineTo: searchParams?.deadline_to,
    active: searchParams?.status !== 'expired' && searchParams?.status !== 'awarded',
    limit,
    offset
  }

  // Use a custom query to call our API endpoint with enhanced error handling
  const {
    data: searchResult,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    failureCount,
    failureReason
  } = useQuery({
    queryKey: ['opportunities', filters],
    queryFn: async ({ signal }) => {
      // Force real data - skip mock mode check for development
      const isMockMode = false // typeof window !== 'undefined' && localStorage.getItem('mock-auth-session')
      
      if (isMockMode) {
        // Return mock opportunities data for development
        await new Promise(resolve => setTimeout(resolve, 800)) // Simulate API delay
        
        const mockOpportunities = Array.from({ length: filters.limit }, (_, i) => ({
          id: `mock-opp-${filters.offset + i + 1}`,
          title: `Medical Equipment Supply Contract ${filters.offset + i + 1}`,
          description: `Supply of medical equipment and supplies for government facilities. This is a mock opportunity for development testing.`,
          notice_id: `MOCK-${Date.now()}-${i}`,
          department: 'Department of Veterans Affairs',
          sub_tier: 'Veterans Health Administration',
          office_address: {
            city: 'Washington',
            state: 'DC',
            zip_code: '20420'
          },
          primary_naics_code: '339112',
          response_deadline: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          posted_date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          type: 'Combined Synopsis/Solicitation',
          base_type: 'Combined Synopsis/Solicitation',
          set_aside_description: Math.random() > 0.5 ? 'Small Business Set-Aside' : null,
          classification_code: '6515',
          active: 'Yes',
          award_amount: Math.floor(Math.random() * 5000000) + 100000,
          matchScore: Math.floor(Math.random() * 40) + 60,
          isSaved: Math.random() > 0.8
        }))
        
        return {
          opportunities: mockOpportunities,
          totalCount: 847, // Mock total count
          hasMore: (filters.offset + filters.limit) < 847,
          quotaStatus: {
            remaining: 756,
            total: 1000,
            warningThreshold: 200
          }
        }
      }

      const params = new URLSearchParams()
      
      if (filters.searchQuery) params.set('q', filters.searchQuery)
      if (filters.naicsCodes?.length) params.set('naics', filters.naicsCodes.join(','))
      if (filters.state) params.set('state', filters.state)
      if (filters.set_aside && filters.set_aside !== 'all') params.set('set_aside', filters.set_aside)
      if (filters.responseDeadlineFrom) params.set('deadline_from', filters.responseDeadlineFrom)
      if (filters.responseDeadlineTo) params.set('deadline_to', filters.responseDeadlineTo)
      params.set('limit', filters.limit.toString())
      params.set('offset', filters.offset.toString())
      
      // Create timeout controller
      const timeoutId = setTimeout(() => {
        if (!signal?.aborted) {
          throw new Error('Request timeout: The server is taking too long to respond')
        }
      }, 30000) // 30 second timeout

      try {
        // Start with the optimized search endpoint that works
        let response = await fetch(`/api/opportunities/search-optimized?${params.toString()}`, {
          signal,
          headers: {
            'Content-Type': 'application/json',
          }
        })
        
        // Fallback to fast endpoint if optimized fails
        if (!response.ok && response.status === 404) {
          console.log('Optimized search endpoint not found, trying fast search')
          response = await fetch(`/api/opportunities/search-fast?${params.toString()}`, {
            signal,
            headers: {
              'Content-Type': 'application/json',
            }
          })
          
          // Final fallback to regular search endpoint
          if (!response.ok && response.status === 404) {
            console.log('Optimized search endpoint not found, falling back to regular search')
            response = await fetch(`/api/opportunities/search?${params.toString()}`, {
              signal,
              headers: {
                'Content-Type': 'application/json',
              }
            })
          }
        }
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          if (response.status === 408 || response.status === 504) {
            throw new Error('Server timeout: Please try again in a moment')
          } else if (response.status === 429) {
            throw new Error('Too many requests: Please wait a moment before trying again')
          } else if (response.status === 503) {
            throw new Error('Service temporarily unavailable: SAM.gov API may be down')
          } else if (response.status >= 500) {
            throw new Error('Server error: Please try again later')
          } else if (response.status === 404) {
            throw new Error('API endpoint not found: Please refresh the page')
          } else {
            throw new Error(`Request failed: ${response.status} ${response.statusText}`)
          }
        }

        const data = await response.json()
        
        // Transform the response to match expected format
        // Map API response fields to component expected fields
        const transformedOpportunities = (data.opportunities || []).map((opp: any) => ({
          ...opp,
          matchScore: opp.match_score || 0, // API returns match_score, component expects matchScore
          isSaved: opp.is_saved || false // API returns is_saved, component expects isSaved
        }))
        
        return {
          opportunities: transformedOpportunities,
          totalCount: data.pagination?.total || 0,
          hasMore: data.pagination?.has_more || false,
          quotaStatus: {
            remaining: 756,
            total: 1000,
            warningThreshold: 200
          },
          performance: data.performance
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Request was cancelled')
        } else if (fetchError.message?.includes('Failed to fetch')) {
          throw new Error('Network error: Check your internet connection')
        } else {
          throw fetchError
        }
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - balanced for real-time updates
    gcTime: 10 * 60 * 1000, // 10 minutes - keep data in cache
    refetchInterval: false, // Don't auto-refetch
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx) except timeouts
      if (error?.message?.includes('Request timeout') || 
          error?.message?.includes('Server timeout') ||
          error?.message?.includes('Network error') ||
          error?.message?.includes('temporarily unavailable')) {
        return failureCount < 3
      }
      if (error?.message?.includes('Too many requests')) {
        return failureCount < 2
      }
      return failureCount < 1
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
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
  const quotaStatus = searchResult?.quotaStatus
  const performanceMetrics = searchResult?.performance

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
      {/* API Quota Status */}
      <QuotaIndicator quotaStatus={quotaStatus} />
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
          <BulkExportButtonDynamic
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
      
      {/* Performance Indicator (dev only) */}
      <PerformanceIndicator 
        metrics={performanceMetrics} 
        show={!isLoading && performanceMetrics !== undefined}
      />
    </div>
  )
}