/**
 * Analytics Dashboard Component
 * Main dashboard with all analytics charts and data visualizations
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { RefreshCw, AlertCircle, Download, FileText, FileSpreadsheet } from 'lucide-react'
import { OpportunityTrendChart } from './opportunity-trend-chart'
import { PerformanceChart } from './performance-chart'
import { NAICSDistributionChart } from './naics-distribution-chart'
import { StatusDistributionChart } from './status-distribution-chart'
import { WinProbabilityChart } from './win-probability-chart'
import { ActivityHeatmap } from './activity-heatmap'

interface IAnalyticsDashboardProps {
  searchParams?: {
    period?: string
    type?: string
  }
}

export function AnalyticsDashboard({ searchParams }: IAnalyticsDashboardProps) {
  const [refreshing, setRefreshing] = useState(false)
  
  const period = searchParams?.period || '30d'
  const type = searchParams?.type || 'overview'

  const {
    data: analyticsData,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['analytics', period, type],
    queryFn: async () => {
      const params = new URLSearchParams({ period, type })
      const response = await fetch(`/api/analytics?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 10 * 60 * 1000 // Refetch every 10 minutes
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setTimeout(() => setRefreshing(false), 1000)
  }

  const handleExport = async (type: 'pdf' | 'excel') => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          format: 'analytics',
          filters: { period, type: searchParams?.type || 'overview' },
          options: {
            includeAnalysis: true,
            includeCharts: type === 'pdf', // Only include charts in PDF
            template: 'standard'
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `analytics-${type}-${Date.now()}.${type === 'pdf' ? 'pdf' : 'xlsx'}`

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
      // TODO: Show error toast
    }
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load analytics data: {error?.message || 'Unknown error occurred'}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            className="mt-4"
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !analyticsData) {
    return <AnalyticsDashboardSkeleton />
  }

  const { data } = analyticsData

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date(analyticsData.generatedAt).toLocaleString()}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="mr-2 h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      {data.summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalOpportunities.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Available in system</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Saved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalSaved.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">In your pipeline</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">AI Analyses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalAnalyses.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Generated insights</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Proposals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalProposals.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Created</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.recentActivity.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Opportunity Trends */}
        {data.opportunities?.timeline && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Opportunity Trends</CardTitle>
              <p className="text-sm text-muted-foreground">
                New opportunities and your saved activity over time
              </p>
            </CardHeader>
            <CardContent>
              <OpportunityTrendChart 
                data={data.opportunities.timeline}
                period={period}
              />
            </CardContent>
          </Card>
        )}

        {/* Performance Chart */}
        {data.performance?.dailyActivity && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Activity</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your engagement patterns
              </p>
            </CardHeader>
            <CardContent>
              <PerformanceChart 
                data={data.performance.dailyActivity}
                totalSaved={data.performance.totalSaved}
                totalAnalyses={data.performance.totalAnalyses}
              />
            </CardContent>
          </Card>
        )}

        {/* Win Probability Distribution */}
        {data.performance?.winProbabilityDistribution && (
          <Card>
            <CardHeader>
              <CardTitle>Win Probability Distribution</CardTitle>
              <p className="text-sm text-muted-foreground">
                AI-calculated success likelihood
              </p>
            </CardHeader>
            <CardContent>
              <WinProbabilityChart 
                data={data.performance.winProbabilityDistribution}
                avgWinProbability={data.performance.avgWinProbability}
              />
            </CardContent>
          </Card>
        )}

        {/* NAICS Distribution */}
        {data.opportunities?.naicsDistribution && (
          <Card>
            <CardHeader>
              <CardTitle>Top Industry Sectors</CardTitle>
              <p className="text-sm text-muted-foreground">
                NAICS code distribution
              </p>
            </CardHeader>
            <CardContent>
              <NAICSDistributionChart 
                data={data.opportunities.naicsDistribution}
              />
            </CardContent>
          </Card>
        )}

        {/* Status Distribution */}
        {data.opportunities?.statusDistribution && (
          <Card>
            <CardHeader>
              <CardTitle>Opportunity Status</CardTitle>
              <p className="text-sm text-muted-foreground">
                Current status breakdown
              </p>
            </CardHeader>
            <CardContent>
              <StatusDistributionChart 
                data={data.opportunities.statusDistribution}
                total={data.opportunities.totalOpportunities}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function AnalyticsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary Stats Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted animate-pulse rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded w-16 mb-2" />
              <div className="h-3 bg-muted animate-pulse rounded w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="h-6 bg-muted animate-pulse rounded w-32" />
            <div className="h-4 bg-muted animate-pulse rounded w-48" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>

        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-muted animate-pulse rounded w-32" />
              <div className="h-4 bg-muted animate-pulse rounded w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-[250px] bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}