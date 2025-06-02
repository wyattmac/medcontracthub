/**
 * Opportunities Stats - Overview statistics for opportunities
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Target, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Clock,
  Building2
} from 'lucide-react'

// Mock stats API call - in real implementation, this would call your API
async function fetchOpportunityStats() {
  // This would be replaced with actual API call
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

export function OpportunitiesStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['opportunity-stats'],
    queryFn: fetchOpportunityStats,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  if (isLoading) {
    return <StatsCardsSkeleton />
  }

  if (!stats) {
    return null
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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