/**
 * Insights Panel Component
 * AI-generated recommendations and insights
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  Lightbulb,
  Target,
  Clock
} from 'lucide-react'

interface Insight {
  id: string
  type: 'opportunity' | 'warning' | 'suggestion' | 'achievement'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  confidence: number
  actionable: boolean
  timestamp: Date
}

export function InsightsPanel() {
  const [insights] = useState<Insight[]>([
    {
      id: '1',
      type: 'opportunity',
      title: 'High-Value Opportunities Detected',
      description: 'AI analysis shows 3 new opportunities matching your success profile with combined value of $2.4M',
      priority: 'high',
      confidence: 94,
      actionable: true,
      timestamp: new Date(Date.now() - 1000 * 60 * 15) // 15 minutes ago
    },
    {
      id: '2',
      type: 'warning',
      title: 'Response Time Declining',
      description: 'Your average response time to new opportunities has increased by 23% this week',
      priority: 'medium',
      confidence: 87,
      actionable: true,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
    },
    {
      id: '3',
      type: 'suggestion',
      title: 'Optimize NAICS Targeting',
      description: 'Focus on NAICS 621111 (medical offices) - your win rate is 34% higher than average',
      priority: 'medium',
      confidence: 91,
      actionable: true,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4) // 4 hours ago
    },
    {
      id: '4',
      type: 'achievement',
      title: 'Monthly Goal Achieved',
      description: 'Congratulations! You\'ve reached your monthly opportunity tracking goal 5 days early',
      priority: 'low',
      confidence: 100,
      actionable: false,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6) // 6 hours ago
    }
  ])

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />
      case 'suggestion':
        return <Lightbulb className="h-4 w-4 text-blue-600" />
      case 'achievement':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      default:
        return <Brain className="h-4 w-4 text-purple-600" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'opportunity':
        return 'border-l-green-500 bg-green-50'
      case 'warning':
        return 'border-l-amber-500 bg-amber-50'
      case 'suggestion':
        return 'border-l-blue-500 bg-blue-50'
      case 'achievement':
        return 'border-l-emerald-500 bg-emerald-50'
      default:
        return 'border-l-purple-500 bg-purple-50'
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive" className="text-xs">High</Badge>
      case 'medium':
        return <Badge variant="default" className="text-xs">Medium</Badge>
      case 'low':
        return <Badge variant="secondary" className="text-xs">Low</Badge>
      default:
        return null
    }
  }

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffMins < 60) {
      return `${diffMins}m ago`
    } else {
      return `${diffHours}h ago`
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          AI Insights
          <Badge variant="outline" className="text-xs font-normal">
            Beta
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight) => (
            <div 
              key={insight.id}
              className={`border-l-4 rounded-r-lg p-4 ${getInsightColor(insight.type)}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getInsightIcon(insight.type)}
                  <span className="font-medium text-gray-900 text-sm">
                    {insight.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(insight.priority)}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                {insight.description}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {insight.confidence}% confidence
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(insight.timestamp)}
                  </div>
                </div>
                
                {insight.actionable && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-xs h-6 px-2 hover:bg-white"
                  >
                    Act on this
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Generate New Insights Button */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
          >
            <Brain className="h-4 w-4 mr-2" />
            Generate New Insights
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}