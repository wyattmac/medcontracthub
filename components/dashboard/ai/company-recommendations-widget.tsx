/**
 * Company Recommendations Widget - AI-powered strategic recommendations
 */

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Brain, 
  TrendingUp, 
  Lightbulb, 
  Target,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { ICompanyRecommendations } from '@/lib/ai/claude-client'

export function CompanyRecommendationsWidget() {
  const [expanded, setExpanded] = useState(false)

  const { 
    data: recommendationsData, 
    isLoading, 
    isError, 
    error,
    refetch,
    isFetching 
  } = useQuery({
    queryKey: ['company-recommendations'],
    queryFn: async () => {
      const response = await fetch('/api/ai/recommendations')
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations')
      }
      return response.json()
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2
  })

  const recommendations = recommendationsData?.recommendations as ICompanyRecommendations | undefined
  const cached = recommendationsData?.cached
  const generatedAt = recommendationsData?.generatedAt

  const handleRefresh = () => {
    refetch()
    toast.info('Refreshing recommendations...')
  }

  if (isLoading) {
    return <CompanyRecommendationsWidgetSkeleton />
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load recommendations: {error?.message || 'Unknown error'}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            className="mt-4 w-full"
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!recommendations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No recommendations available yet
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const urgentCount = recommendations.highPriorityOpportunities.filter(
    opp => opp.urgency === 'high'
  ).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Recommendations
          </div>
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {urgentCount} urgent
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* High Priority Opportunities */}
        {recommendations.highPriorityOpportunities.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-red-500" />
              Priority Opportunities ({recommendations.highPriorityOpportunities.length})
            </h4>
            <div className="space-y-2">
              {recommendations.highPriorityOpportunities.slice(0, expanded ? undefined : 3).map((opp, index) => (
                <div 
                  key={opp.opportunityId || index}
                  className="p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Badge 
                        variant={opp.urgency === 'high' ? 'destructive' : 
                                opp.urgency === 'medium' ? 'secondary' : 'outline'}
                        className="text-xs mb-2"
                      >
                        {opp.urgency} urgency
                      </Badge>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {opp.reasoning}
                      </p>
                    </div>
                    {opp.opportunityId && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/opportunities/${opp.opportunityId}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {recommendations.highPriorityOpportunities.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="w-full"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="mr-2 h-4 w-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-2 h-4 w-4" />
                      Show {recommendations.highPriorityOpportunities.length - 3} More
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Quick Insights */}
        <div className="grid grid-cols-1 gap-3">
          {/* Industry Trends */}
          {recommendations.industryTrends.length > 0 && (
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Market Trends
              </h4>
              <div className="space-y-1">
                {recommendations.industryTrends.slice(0, 2).map((trend, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 shrink-0" />
                    <p className="text-xs text-gray-600 leading-relaxed">{trend}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actionable Recommendations */}
          {recommendations.actionableRecommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Quick Actions
              </h4>
              <div className="space-y-1">
                {recommendations.actionableRecommendations.slice(0, 2).map((action, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2 shrink-0" />
                    <p className="text-xs text-gray-600 leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capability Gaps */}
          {recommendations.capabilityGaps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Growth Opportunities
              </h4>
              <div className="space-y-1">
                {recommendations.capabilityGaps.slice(0, 2).map((gap, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 shrink-0" />
                    <p className="text-xs text-gray-600 leading-relaxed">{gap}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* View All Link */}
        <div className="pt-3 border-t">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/dashboard/recommendations">
              View Detailed Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Analysis Footer */}
        <Alert>
          <Brain className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {cached ? 'Analysis cached' : 'Analysis generated'} on{' '}
            {generatedAt ? format(new Date(generatedAt), 'MMM d, h:mm a') : 'unknown date'}.
            Based on {recommendationsData?.basedOn?.savedOpportunities || 0} saved opportunities.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

function CompanyRecommendationsWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-3 w-full bg-muted animate-pulse rounded" />
            <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}