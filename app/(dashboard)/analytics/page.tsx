/**
 * Analytics Dashboard Page
 * Shows comprehensive business intelligence and performance metrics
 */

import { Suspense } from 'react'
import { AnalyticsDashboard } from '@/components/dashboard/analytics/analytics-dashboard'
import { AnalyticsFilters } from '@/components/dashboard/analytics/analytics-filters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, TrendingUp, Target, Activity } from 'lucide-react'

interface IAnalyticsPageProps {
  searchParams?: {
    period?: string
    type?: string
  }
}

export default function AnalyticsPage({ searchParams }: IAnalyticsPageProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track your performance and identify opportunities for growth
          </p>
        </div>
        <div className="flex items-center gap-4">
          <AnalyticsFilters searchParams={searchParams} />
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Loading...</div>
            <p className="text-xs text-muted-foreground">
              Available in system
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saved Opportunities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Loading...</div>
            <p className="text-xs text-muted-foreground">
              In your pipeline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Analyses</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Loading...</div>
            <p className="text-xs text-muted-foreground">
              Generated insights
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Win Probability</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Loading...</div>
            <p className="text-xs text-muted-foreground">
              AI-calculated average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Dashboard */}
      <Suspense fallback={<AnalyticsDashboardSkeleton />}>
        <AnalyticsDashboard searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

function AnalyticsDashboardSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Chart Skeletons */}
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="h-6 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export const metadata = {
  title: 'Analytics Dashboard - MedContractHub',
  description: 'Business intelligence and performance analytics for federal contract opportunities'
}