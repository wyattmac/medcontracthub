/**
 * Live Metrics Widget
 * Real-time dashboard metrics with auto-refresh
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  TrendingUp, 
  Users, 
  Clock, 
  Zap,
  AlertCircle
} from 'lucide-react'

interface LiveMetric {
  id: string
  label: string
  value: string
  change: number
  trend: 'up' | 'down' | 'stable'
  icon: React.ReactNode
  color: string
}

export function LiveMetricsWidget() {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isLive, setIsLive] = useState(true)
  const [metrics, setMetrics] = useState<LiveMetric[]>([
    {
      id: 'active-users',
      label: 'Active Users',
      value: '12',
      change: 5.2,
      trend: 'up',
      icon: <Users className="h-4 w-4" />,
      color: 'text-blue-600'
    },
    {
      id: 'opportunities-today',
      label: 'New Today',
      value: '8',
      change: -2.1,
      trend: 'down',
      icon: <Activity className="h-4 w-4" />,
      color: 'text-green-600'
    },
    {
      id: 'response-time',
      label: 'Avg Response',
      value: '124ms',
      change: 0.8,
      trend: 'stable',
      icon: <Zap className="h-4 w-4" />,
      color: 'text-amber-600'
    },
    {
      id: 'system-health',
      label: 'System Health',
      value: '99.8%',
      change: 0.1,
      trend: 'up',
      icon: <TrendingUp className="h-4 w-4" />,
      color: 'text-emerald-600'
    }
  ])

  // Simulate real-time updates
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      setMetrics(prev => prev.map(metric => ({
        ...metric,
        value: generateRandomValue(metric.id),
        change: (Math.random() - 0.5) * 10,
        trend: Math.random() > 0.6 ? 'up' : Math.random() > 0.3 ? 'down' : 'stable'
      })))
      setLastUpdate(new Date())
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [isLive])

  const generateRandomValue = (id: string): string => {
    switch (id) {
      case 'active-users':
        return Math.floor(Math.random() * 20 + 5).toString()
      case 'opportunities-today':
        return Math.floor(Math.random() * 15 + 3).toString()
      case 'response-time':
        return Math.floor(Math.random() * 200 + 80) + 'ms'
      case 'system-health':
        return (99.5 + Math.random() * 0.5).toFixed(1) + '%'
      default:
        return '0'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />
      case 'down':
        return <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />
      default:
        return <div className="h-3 w-3 bg-gray-400 rounded-full" />
    }
  }

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Live Metrics
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <Badge variant={isLive ? 'default' : 'secondary'} className="text-xs">
              {isLive ? 'LIVE' : 'PAUSED'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div 
              key={metric.id}
              className="bg-white rounded-lg p-3 border border-slate-200 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`${metric.color}`}>
                  {metric.icon}
                </div>
                {getTrendIcon(metric.trend)}
              </div>
              
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">
                  {metric.value}
                </div>
                <div className="text-xs text-gray-600">
                  {metric.label}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-medium ${
                    metric.change > 0 ? 'text-green-600' : 
                    metric.change < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-400">vs prev</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
            <button 
              onClick={() => setIsLive(!isLive)}
              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
            >
              {isLive ? (
                <>
                  <div className="h-2 w-2 bg-red-500 rounded-full" />
                  Pause
                </>
              ) : (
                <>
                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                  Resume
                </>
              )}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}