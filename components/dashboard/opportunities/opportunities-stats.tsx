/**
 * Opportunities Stats - Overview statistics for opportunities
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Target, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Clock,
  Building2,
  RefreshCw,
  AlertCircle
} from 'lucide-react'

// Real API call for opportunity stats
async function fetchOpportunityStats({ signal }: { signal?: AbortSignal }) {
  // Check if we're in mock mode
  const isMockMode = typeof window !== 'undefined' && localStorage.getItem('mock-auth-session')
  
  if (isMockMode) {
    // Return mock data for development
    await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API delay
    return {
      totalActive: 1247,
      newThisWeek: 84,
      expiringThisWeek: 23,
      totalValue: 2400000000,
      averageValue: 1920000,
      highMatchCount: 156,
      mediumMatchCount: 342,
      lowMatchCount: 749
    }
  }

  // Create timeout controller for real API calls
  const timeoutId = setTimeout(() => {
    if (!signal?.aborted) {
      throw new Error('Request timeout: Stats are taking too long to load')
    }
  }, 15000) // 15 second timeout for stats

  try {
    const response = await fetch('/api/opportunities/stats', {
      signal,
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      if (response.status === 408 || response.status === 504) {
        throw new Error('Stats timeout: Please try refreshing the page')
      } else if (response.status === 429) {
        throw new Error('Too many requests: Please wait a moment')
      } else if (response.status === 503) {
        throw new Error('Statistics temporarily unavailable')
      } else if (response.status >= 500) {
        throw new Error('Server error: Stats temporarily unavailable')
      } else if (response.status === 404) {
        throw new Error('Statistics endpoint not found')
      } else {
        throw new Error(`Failed to load stats: ${response.status}`)
      }
    }

    const data = await response.json()
    return data
  } catch (fetchError: any) {
    clearTimeout(timeoutId)
    
    if (fetchError.name === 'AbortError') {
      throw new Error('Request was cancelled')
    } else if (fetchError.message?.includes('Failed to fetch')) {
      throw new Error('Network error: Check your connection')
    } else {
      throw fetchError
    }
  }
}

export function OpportunitiesStats() {
  const { 
    data: stats, 
    isLoading, 
    isError, 
    error, 
    refetch, 
    isFetching,
    failureCount 
  } = useQuery({
    queryKey: ['opportunity-stats'],
    queryFn: fetchOpportunityStats,
    staleTime: 10 * 60 * 1000, // 10 minutes - increased for better performance
    gcTime: 30 * 60 * 1000, // 30 minutes - keep cached longer
    retry: (failureCount, error) => {
      // Retry on timeouts and network errors
      if (error?.message?.includes('timeout') || 
          error?.message?.includes('Network error') ||
          error?.message?.includes('temporarily unavailable')) {
        return failureCount < 3
      }
      if (error?.message?.includes('Too many requests')) {
        return failureCount < 2
      }
      return failureCount < 1
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  })

  const handleRefresh = () => {
    refetch()
  }

  if (isLoading) {
    return <StatsCardsSkeleton />
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load statistics: {error?.message || 'Unknown error occurred'}
              {failureCount > 0 && (
                <span className="block mt-1 text-xs">
                  Retry attempt {failureCount}/3
                </span>
              )}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
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

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No statistics available
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="sm"
              className="mt-4 block mx-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Load Stats
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Total Active Opportunities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Opportunities</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalActive.toLocaleString()}</div>
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
            +{stats.newThisWeek} new this week
          </div>
        </CardContent>
      </Card>

      {/* Expiring Soon */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Expiring This Week</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{stats.expiringThisWeek}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Response deadlines ending
          </p>
        </CardContent>
      </Card>

      {/* Total Contract Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Avg: {formatCurrency(stats.averageValue)} per contract
          </p>
        </CardContent>
      </Card>

      {/* Match Quality Distribution */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Match Quality</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">High</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {stats.highMatchCount}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-sm">Medium</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {stats.mediumMatchCount}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-sm">Low</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {stats.lowMatchCount}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-4 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}