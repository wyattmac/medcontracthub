/**
 * Saved Opportunities Filters - Filter saved opportunities
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Filter, X } from 'lucide-react'

interface ISavedOpportunitiesFiltersProps {
  filters: {
    isPursuing?: boolean
    hasReminder?: boolean
    tags: string[]
    sortBy: 'deadline' | 'saved_date' | 'match_score'
  }
  onFiltersChange: (filters: any) => void
  isLoading: boolean
}

const SORT_OPTIONS = [
  { value: 'deadline', label: 'Response Deadline' },
  { value: 'saved_date', label: 'Date Saved' },
  { value: 'match_score', label: 'Match Score' }
]

const PURSUING_OPTIONS = [
  { value: 'all', label: 'All Opportunities' },
  { value: 'true', label: 'Actively Pursuing' },
  { value: 'false', label: 'Not Pursuing' }
]

const REMINDER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'With Reminders' },
  { value: 'false', label: 'No Reminders' }
]

export function SavedOpportunitiesFilters({ 
  filters, 
  onFiltersChange, 
  isLoading 
}: ISavedOpportunitiesFiltersProps) {
  
  const handlePursuingChange = (value: string) => {
    onFiltersChange({
      ...filters,
      isPursuing: value === 'all' ? undefined : value === 'true'
    })
  }

  const handleReminderChange = (value: string) => {
    onFiltersChange({
      ...filters,
      hasReminder: value === 'all' ? undefined : value === 'true'
    })
  }

  const handleSortChange = (value: string) => {
    onFiltersChange({
      ...filters,
      sortBy: value as 'deadline' | 'saved_date' | 'match_score'
    })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      isPursuing: undefined,
      hasReminder: undefined,
      tags: [],
      sortBy: 'deadline'
    })
  }

  const hasActiveFilters = filters.isPursuing !== undefined || 
                          filters.hasReminder !== undefined || 
                          filters.tags.length > 0

  const getPursuingValue = () => {
    if (filters.isPursuing === undefined) return 'all'
    return filters.isPursuing ? 'true' : 'false'
  }

  const getReminderValue = () => {
    if (filters.hasReminder === undefined) return 'all'
    return filters.hasReminder ? 'true' : 'false'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sort By */}
        <div className="space-y-2">
          <Label>Sort By</Label>
          <Select value={filters.sortBy} onValueChange={handleSortChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pursuing Status */}
        <div className="space-y-2">
          <Label>Pursuing Status</Label>
          <Select value={getPursuingValue()} onValueChange={handlePursuingChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PURSUING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reminder Status */}
        <div className="space-y-2">
          <Label>Reminders</Label>
          <Select value={getReminderValue()} onValueChange={handleReminderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags Filter */}
        {filters.tags.length > 0 && (
          <div className="space-y-2">
            <Label>Active Tags</Label>
            <div className="flex flex-wrap gap-1">
              {filters.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      onFiltersChange({
                        ...filters,
                        tags: filters.tags.filter(t => t !== tag)
                      })
                    }}
                    className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Clear All Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="w-full"
            disabled={isLoading}
          >
            <X className="mr-2 h-4 w-4" />
            Clear All Filters
          </Button>
        )}

        {/* Quick Filter Buttons */}
        <div className="space-y-2 pt-4 border-t">
          <Label>Quick Filters</Label>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFiltersChange({
                ...filters,
                isPursuing: true,
                sortBy: 'deadline'
              })}
              className="w-full justify-start"
              disabled={isLoading}
            >
              <Filter className="mr-2 h-4 w-4" />
              Pursuing Only
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFiltersChange({
                ...filters,
                hasReminder: true,
                sortBy: 'deadline'
              })}
              className="w-full justify-start"
              disabled={isLoading}
            >
              <Filter className="mr-2 h-4 w-4" />
              With Reminders
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}