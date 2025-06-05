/**
 * SAM.gov API Quota Dashboard
 * Displays real-time quota usage and optimization suggestions
 */

'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Zap, 
  TrendingDown, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  BarChart3,
  RefreshCw,
  Settings,
  Lightbulb
} from 'lucide-react'

interface QuotaStatus {
  quota: {
    daily: {
      used: number
      remaining: number
      resetsAt: string
    }
    hourly: {
      used: number
      remaining: number
      resetsAt: string
    }
  }
  config: {
    dailyLimit: number
    hourlyLimit: number
    emergencyThreshold: number
    warningThreshold: number
  }
  analytics: {
    topOperations: Array<{ operation: string; count: number }>
    topUsers: Array<{ user_id: string; count: number }>
    hourlyPattern: Array<{ hour: number; count: number }>
    efficiency: number
    peakHours: Array<{ hour: number; label: string; count: number }>
  }
  optimization: {
    suggestions: Array<{
      type: 'cache' | 'batch' | 'schedule' | 'filter'
      title: string
      description: string
      savings: number
    }>
    recommendedActions: Array<{
      priority: 'high' | 'medium' | 'low'
      action: string
      description: string
      impact: string
    }>
    nextOptimalWindow: {
      hour: number
      label: string
      usageLevel: 'low' | 'medium' | 'high'
    }
  }
}

async function fetchQuotaStatus(): Promise<QuotaStatus> {
  // Check if we're in mock mode
  const isMockMode = typeof window !== 'undefined' && localStorage.getItem('mock-auth-session')
  
  const endpoint = isMockMode ? '/api/quota/mock' : '/api/quota'
  const response = await fetch(endpoint)
  
  if (!response.ok) {
    throw new Error('Failed to fetch quota status')
  }
  return response.json()
}

export function QuotaDashboard() {
  const { data: status, isLoading, error, refetch } = useQuery({
    queryKey: ['quota-status'],
    queryFn: fetchQuotaStatus,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000 // 30 seconds
  })

  if (isLoading) {
    return <QuotaDashboardSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load quota status. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (!status) return null

  const dailyUsagePercent = (status.quota.daily.used / status.config.dailyLimit) * 100
  const hourlyUsagePercent = (status.quota.hourly.used / status.config.hourlyLimit) * 100
  
  const getUsageLevel = (percent: number) => {
    if (percent >= 90) return 'critical'
    if (percent >= 70) return 'warning'
    return 'normal'
  }

  const dailyLevel = getUsageLevel(dailyUsagePercent)
  const hourlyLevel = getUsageLevel(hourlyUsagePercent)

  return (
    <div className="space-y-6">
      {/* Quota Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Quota */}
        <Card className={dailyLevel === 'critical' ? 'border-red-200 bg-red-50' : 
                        dailyLevel === 'warning' ? 'border-yellow-200 bg-yellow-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Daily Quota
              {dailyLevel === 'critical' && <Badge variant="destructive">Critical</Badge>}
              {dailyLevel === 'warning' && <Badge variant="secondary">Warning</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-2xl font-bold">
                {status.quota.daily.remaining.toLocaleString()} / {status.config.dailyLimit.toLocaleString()}
              </div>
              <Progress value={dailyUsagePercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{status.quota.daily.used} used</span>
                <span>Resets {new Date(status.quota.daily.resetsAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hourly Quota */}
        <Card className={hourlyLevel === 'critical' ? 'border-red-200 bg-red-50' : 
                        hourlyLevel === 'warning' ? 'border-yellow-200 bg-yellow-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hourly Rate
              {hourlyLevel === 'critical' && <Badge variant="destructive">Rate Limited</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-2xl font-bold">
                {status.quota.hourly.used} / {status.config.hourlyLimit}
              </div>
              <Progress value={hourlyUsagePercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>This hour</span>
                <span>Resets {new Date(status.quota.hourly.resetsAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Actions */}
      {status.optimization.recommendedActions.some(a => a.priority === 'high') && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Immediate Actions Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {status.optimization.recommendedActions
                .filter(action => action.priority === 'high')
                .map((action, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">{action.action}</div>
                      <div className="text-sm text-muted-foreground">{action.description}</div>
                      <div className="text-xs text-green-600 mt-1">💡 {action.impact}</div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Operations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              API Usage Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {status.analytics.topOperations.map((op, index) => (
                <div key={op.operation} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{op.operation}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ 
                          width: `${(op.count / status.analytics.topOperations[0]?.count) * 100}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{op.count}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium">Efficiency Score</div>
              <div className="text-2xl font-bold text-green-600">{status.analytics.efficiency}%</div>
              <div className="text-xs text-muted-foreground">API calls to useful results ratio</div>
            </div>
          </CardContent>
        </Card>

        {/* Optimization Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Optimization Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {status.optimization.suggestions.slice(0, 3).map((suggestion, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{suggestion.title}</span>
                    <Badge variant="outline" className="text-xs">
                      -{suggestion.savings} calls
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {suggestion.description}
                  </div>
                </div>
              ))}
            </div>

            {/* Next Optimal Window */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Next Optimal Window
              </div>
              <div className="text-lg font-bold">{status.optimization.nextOptimalWindow.label}</div>
              <div className="text-xs text-muted-foreground">
                {status.optimization.nextOptimalWindow.usageLevel} usage period - ideal for background tasks
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-3 w-3 mr-1" />
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function QuotaDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-8 bg-gray-200 rounded w-32 animate-pulse" />
                <div className="h-2 bg-gray-200 rounded animate-pulse" />
                <div className="flex justify-between">
                  <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-20 animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-4 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}