/**
 * Analytics Filters Component
 * Allows users to filter analytics data by time period and type
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, RefreshCw, Download, Filter } from 'lucide-react'

interface IAnalyticsFiltersProps {
  searchParams?: {
    period?: string
    type?: string
  }
}

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 days', icon: '📅' },
  { value: '30d', label: 'Last 30 days', icon: '📊' },
  { value: '90d', label: 'Last 90 days', icon: '📈' },
  { value: '1y', label: 'Last year', icon: '🗓️' }
]

const TYPE_OPTIONS = [
  { value: 'overview', label: 'Overview', icon: '🎯', description: 'General performance metrics' },
  { value: 'opportunities', label: 'Opportunities', icon: '🔍', description: 'Opportunity tracking & trends' },
  { value: 'performance', label: 'Performance', icon: '⚡', description: 'Success rates & analytics' },
  { value: 'pipeline', label: 'Pipeline', icon: '💰', description: 'Revenue and pipeline value' }
]

export function AnalyticsFilters({ searchParams }: IAnalyticsFiltersProps) {
  const router = useRouter()
  const currentSearchParams = useSearchParams()

  const currentPeriod = searchParams?.period || '30d'
  const currentType = searchParams?.type || 'overview'

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(currentSearchParams?.toString())
    params.set(key, value)
    router.push(`/analytics?${params.toString()}`)
  }

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Filter Header */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">Analytics Filters</h3>
          </div>

          {/* Filters Container */}
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Time Period Filter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <Label htmlFor="period-select" className="text-sm font-medium text-gray-700">
                  Time Period:
                </Label>
              </div>
              <Select 
                value={currentPeriod} 
                onValueChange={(value) => updateFilters('period', value)}
              >
                <SelectTrigger 
                  id="period-select" 
                  className="w-[160px] bg-white border-blue-200 hover:border-blue-300 focus:border-blue-400"
                >
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="flex items-center gap-2">
                      <span className="mr-2">{option.icon}</span>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Analytics Type Filter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-purple-600" />
                <Label htmlFor="type-select" className="text-sm font-medium text-gray-700">
                  Dashboard View:
                </Label>
              </div>
              <Select 
                value={currentType} 
                onValueChange={(value) => updateFilters('type', value)}
              >
                <SelectTrigger 
                  id="type-select" 
                  className="w-[180px] bg-white border-purple-200 hover:border-purple-300 focus:border-purple-400"
                >
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span>{option.icon}</span>
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-gray-500">{option.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-green-200 text-green-700 hover:bg-green-50"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium">Active filters:</span>
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
            {PERIOD_OPTIONS.find(p => p.value === currentPeriod)?.label}
          </span>
          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
            {TYPE_OPTIONS.find(t => t.value === currentType)?.label}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}