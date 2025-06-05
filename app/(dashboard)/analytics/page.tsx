/**
 * Analytics Dashboard Page
 * Shows comprehensive business intelligence and performance metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, TrendingUp, Target, Activity } from 'lucide-react'
import { SectionErrorBoundary } from '@/components/ui/error-boundary'
import { AnalyticsDashboard, AnalyticsFilters } from './analytics-client'

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header with Gradient */}
      <div className="text-center space-y-4">
        <h1 
          className="text-4xl font-bold"
          style={{
            background: 'linear-gradient(to right, #8b5cf6, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Analytics Dashboard
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Track your performance, monitor opportunities, and optimize your federal contracting strategy
        </p>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">23.5%</span>
              <span className="text-xs text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +2.3%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs last month</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Opportunities Tracked
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">147</span>
              <span className="text-xs text-green-600 flex items-center">
                <Activity className="h-3 w-3 mr-1" />
                Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">This quarter</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pipeline Value
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">$12.4M</span>
              <span className="text-xs text-blue-600 flex items-center">
                <BarChart3 className="h-3 w-3 mr-1" />
                Potential
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total contract value</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            }}
          />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Score
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">87</span>
              <span className="text-xs text-amber-600 flex items-center">
                <Target className="h-3 w-3 mr-1" />
                Good
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">AI confidence score</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <SectionErrorBoundary>
        <AnalyticsFilters />
      </SectionErrorBoundary>

      {/* Main Analytics Dashboard */}
      <SectionErrorBoundary>
        <AnalyticsDashboard />
      </SectionErrorBoundary>
    </div>
  )
}