/**
 * Analytics Dashboard Page
 * Shows comprehensive business intelligence and performance metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, TrendingUp, Target, Activity } from 'lucide-react'
import { SectionErrorBoundary } from '@/components/ui/error-boundary'
import { AnalyticsDashboard, AnalyticsFilters } from './analytics-client'
import { LiveMetricsWidget } from '@/components/dashboard/analytics/live-metrics-widget'
import { InsightsPanel } from '@/components/dashboard/analytics/insights-panel'

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header with Gradient */}
      <div className="text-center space-y-4">
        <h1 
          className="text-4xl font-bold animate-pulse"
          style={{
            background: 'linear-gradient(to right, #8b5cf6, #3b82f6, #10b981)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          🚀 Enhanced Analytics Dashboard
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Track your performance, monitor opportunities, and optimize your federal contracting strategy
        </p>
      </div>

      {/* Enhanced Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <div 
            className="absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity duration-300"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Win Rate
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">
                23.5%
              </span>
              <span className="text-xs text-green-600 flex items-center bg-green-50 px-2 py-1 rounded-full">
                <TrendingUp className="h-3 w-3 mr-1" />
                +2.3%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs last month</p>
            <div className="mt-2 w-full bg-purple-100 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: '23.5%' }}></div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <div 
            className="absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity duration-300"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Opportunities Tracked
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                147
              </span>
              <span className="text-xs text-green-600 flex items-center bg-green-50 px-2 py-1 rounded-full">
                <Activity className="h-3 w-3 mr-1" />
                Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">This quarter</p>
            <div className="mt-2 flex items-center gap-1">
              <div className="text-xs text-blue-600 font-medium">+12 this week</div>
              <div className="flex-1"></div>
              <div className="text-xs text-muted-foreground">📈</div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <div 
            className="absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity duration-300"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Pipeline Value
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-400 bg-clip-text text-transparent">
                $12.4M
              </span>
              <span className="text-xs text-blue-600 flex items-center bg-blue-50 px-2 py-1 rounded-full">
                <BarChart3 className="h-3 w-3 mr-1" />
                Potential
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total contract value</p>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-green-600 font-medium">High: $2.1M</span>
              <span className="text-amber-600">Medium: $6.8M</span>
              <span className="text-gray-500">Low: $3.5M</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <div 
            className="absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity duration-300"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              AI Success Score
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-400 bg-clip-text text-transparent">
                87
              </span>
              <span className="text-xs text-amber-600 flex items-center bg-amber-50 px-2 py-1 rounded-full">
                <Target className="h-3 w-3 mr-1" />
                Excellent
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">AI confidence score</p>
            <div className="mt-2 w-full bg-amber-100 rounded-full h-1.5">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: '87%' }}></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Dashboard Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Left Column - Filters and Live Metrics */}
        <div className="xl:col-span-1 space-y-6">
          <SectionErrorBoundary>
            <AnalyticsFilters />
          </SectionErrorBoundary>
          
          <SectionErrorBoundary>
            <LiveMetricsWidget />
          </SectionErrorBoundary>
        </div>

        {/* Center Column - Main Analytics Dashboard */}
        <div className="xl:col-span-3">
          <SectionErrorBoundary>
            <AnalyticsDashboard />
          </SectionErrorBoundary>
        </div>

        {/* Right Column - AI Insights */}
        <div className="xl:col-span-1">
          <SectionErrorBoundary>
            <InsightsPanel />
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  )
}