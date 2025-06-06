'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  Zap,
  Shield,
  Clock,
  DollarSign
} from 'lucide-react'

export function ApiUsageDashboard() {
  const { data: quotaStatus, isLoading } = useQuery({
    queryKey: ['quota-status'],
    queryFn: async () => {
      const response = await fetch('/api/quota/status')
      if (!response.ok) throw new Error('Failed to fetch quota status')
      return response.json()
    },
    refetchInterval: 60000 // Refresh every minute
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="p-6">
              <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!quotaStatus) return null

  const dailyPercentUsed = ((quotaStatus.quota.daily.used / quotaStatus.quota.config.dailyLimit) * 100).toFixed(1)
  const hourlyPercentUsed = ((quotaStatus.quota.hourly.used / quotaStatus.quota.config.hourlyLimit) * 100).toFixed(1)
  const isQuotaLow = quotaStatus.quota.daily.remaining < quotaStatus.quota.config.warningThreshold
  const isQuotaCritical = quotaStatus.quota.daily.remaining < quotaStatus.quota.config.emergencyThreshold

  return (
    <div className="space-y-4">
      {/* Quota Alert */}
      {isQuotaCritical && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Critical: API Quota Almost Exhausted</AlertTitle>
          <AlertDescription>
            Only {quotaStatus.quota.daily.remaining} API calls remaining today. 
            Non-essential operations have been disabled to preserve quota for critical tasks.
          </AlertDescription>
        </Alert>
      )}
      
      {isQuotaLow && !isQuotaCritical && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Warning: Low API Quota</AlertTitle>
          <AlertDescription>
            {quotaStatus.quota.daily.remaining} API calls remaining. 
            Caching has been enhanced to preserve quota.
          </AlertDescription>
        </Alert>
      )}

      {/* Quota Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Quota</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quotaStatus.quota.daily.remaining}/{quotaStatus.quota.config.dailyLimit}
            </div>
            <Progress value={parseFloat(dailyPercentUsed)} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {dailyPercentUsed}% used today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hourly Rate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quotaStatus.quota.hourly.used}/{quotaStatus.quota.config.hourlyLimit}
            </div>
            <Progress value={parseFloat(hourlyPercentUsed)} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Resets in {Math.ceil((new Date(quotaStatus.quota.hourly.resetsAt).getTime() - Date.now()) / 60000)} min
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Performance</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quotaStatus.cache.apiCallsSaved}</div>
            <p className="text-xs text-muted-foreground mt-2">
              API calls saved by caching
            </p>
            <Badge variant="secondary" className="mt-2">
              {quotaStatus.cache.estimatedCostSaved} saved
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              +{quotaStatus.optimization.potentialSavings}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Potential calls saved
            </p>
            <Badge variant="outline" className="mt-2">
              {quotaStatus.optimization.suggestions.length} tips
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Optimization Suggestions */}
      {quotaStatus.optimization.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Optimization Recommendations</CardTitle>
            <CardDescription>
              Ways to reduce API usage and save quota
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {quotaStatus.optimization.suggestions.map((suggestion: any, index: number) => (
              <div key={index} className="flex items-start space-x-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{suggestion.title}</p>
                  <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                  <Badge variant="secondary" className="mt-1">
                    Save ~{suggestion.savings} calls/day
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cache Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Performance Details</CardTitle>
          <CardDescription>
            Real-time cache hit rates by data type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(quotaStatus.cache.stats).map(([type, stats]: [string, any]) => (
              <div key={type} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium capitalize">{type} Cache</span>
                  <span className="text-muted-foreground">
                    {stats.hits}/{stats.hits + stats.misses} hits 
                    ({stats.hits > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <Progress 
                  value={stats.hits > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}