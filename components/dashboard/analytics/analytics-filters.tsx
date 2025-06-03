/**
 * Analytics Filters Component
 * Allows users to filter analytics data by time period and type
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface IAnalyticsFiltersProps {
  searchParams?: {
    period?: string
    type?: string
  }
}

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' }
]

const TYPE_OPTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'performance', label: 'Performance' }
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
    <div className="flex items-center gap-4">
      {/* Time Period Filter */}
      <div className="flex items-center gap-2">
        <Label htmlFor="period-select" className="text-sm font-medium whitespace-nowrap">
          Period:
        </Label>
        <Select 
          value={currentPeriod} 
          onValueChange={(value) => updateFilters('period', value)}
        >
          <SelectTrigger id="period-select" className="w-[140px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Analytics Type Filter */}
      <div className="flex items-center gap-2">
        <Label htmlFor="type-select" className="text-sm font-medium whitespace-nowrap">
          View:
        </Label>
        <Select 
          value={currentType} 
          onValueChange={(value) => updateFilters('type', value)}
        >
          <SelectTrigger id="type-select" className="w-[130px]">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}