/**
 * User Journey Monitoring Dashboard
 * Real-time monitoring of critical user flows
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Activity, CheckCircle, XCircle, Clock, Zap, AlertTriangle } from 'lucide-react'

interface JourneyResult {
  journeyName: string
  timestamp: string
  success: boolean
  totalTime: number
  stepResults: Array<{
    stepName: string
    success: boolean
    responseTime: number
    performanceScore: 'good' | 'needs-improvement' | 'poor'
    error?: string
  }>
  error?: string
}

interface MonitoringStatus {
  isRunning: boolean
  scheduledJourneys: number
  activeMonitors: string[]
}

export default function MonitoringDashboard() {
  const [status, setStatus] = useState<MonitoringStatus | null>(null)
  const [journeyResults, setJourneyResults] = useState<JourneyResult[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/monitoring/control')
      const data = await response.json()
      setStatus(data.monitoring)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch monitoring status:', error)
    }
  }

  const runHealthCheck = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/monitoring/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health-check' })
      })
      const data = await response.json()
      setJourneyResults(data.results || [])
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to run health check:', error)
    }
    setLoading(false)
  }

  const controlMonitoring = async (action: 'start' | 'stop') => {
    try {
      const response = await fetch('/api/monitoring/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const data = await response.json()
      setStatus(data.status)
      setLastUpdate(new Date())
    } catch (error) {
      console.error(`Failed to ${action} monitoring:`, error)
    }
  }

  useEffect(() => {
    fetchStatus()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getPerformanceColor = (score: string) => {
    switch (score) {
      case 'good': return 'text-green-600'
      case 'needs-improvement': return 'text-yellow-600'
      case 'poor': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getPerformanceIcon = (score: string) => {
    switch (score) {
      case 'good': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'needs-improvement': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'poor': return <XCircle className="h-4 w-4 text-red-600" />
      default: return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">User Journey Monitoring</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of critical user flows and application health
        </p>
      </div>

      {/* Monitoring Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Monitoring Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={status?.isRunning ? 'default' : 'secondary'}>
                {status?.isRunning ? 'Active' : 'Stopped'}
              </Badge>
              {status?.isRunning && (
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Zap className="h-4 w-4 mr-2" />
              Active Monitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.scheduledJourneys || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Journey monitors running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Last Update
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              Status refresh time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => controlMonitoring('start')}
              disabled={status?.isRunning}
              variant={status?.isRunning ? 'secondary' : 'default'}
            >
              Start Monitoring
            </Button>
            <Button
              onClick={() => controlMonitoring('stop')}
              disabled={!status?.isRunning}
              variant="outline"
            >
              Stop Monitoring
            </Button>
            <Button
              onClick={runHealthCheck}
              disabled={loading}
              variant="outline"
            >
              {loading ? 'Running...' : 'Run Health Check'}
            </Button>
            <Button
              onClick={fetchStatus}
              variant="ghost"
            >
              Refresh Status
            </Button>
          </div>

          {status?.activeMonitors && status.activeMonitors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Active Journey Monitors:</h4>
              <div className="flex flex-wrap gap-1">
                {status.activeMonitors.map((monitor) => (
                  <Badge key={monitor} variant="outline" className="text-xs">
                    {monitor}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journey Results */}
      {journeyResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Health Check Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {journeyResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <h4 className="font-medium">{result.journeyName}</h4>
                      <Badge variant={result.success ? 'default' : 'destructive'}>
                        {result.success ? 'Passed' : 'Failed'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {result.totalTime}ms total
                    </div>
                  </div>

                  {result.error && (
                    <div className="text-sm text-red-600 mb-2">
                      Error: {result.error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {result.stepResults.map((step, stepIndex) => (
                      <div key={stepIndex} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          {getPerformanceIcon(step.performanceScore)}
                          <span className="truncate">{step.stepName}</span>
                        </div>
                        <div className={`text-xs ${getPerformanceColor(step.performanceScore)}`}>
                          {step.responseTime}ms
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Automatic Monitoring:</strong> When enabled, critical user journeys are tested continuously
            at different intervals (every 2-15 minutes depending on importance).
          </p>
          <p>
            <strong>Health Check:</strong> Run all journey tests immediately to get current status.
          </p>
          <p>
            <strong>Performance Scores:</strong> 
            <span className="text-green-600 ml-1">Good (fast)</span>, 
            <span className="text-yellow-600 ml-1">Needs improvement</span>, 
            <span className="text-red-600 ml-1">Poor (slow)</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}