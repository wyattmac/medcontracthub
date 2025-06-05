/**
 * Opportunities Filters - Search and filter opportunities
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Search, X, Filter } from 'lucide-react'

interface IOpportunitiesFiltersProps {
  searchParams?: {
    q?: string
    naics?: string
    state?: string
    status?: string
    deadline_from?: string
    deadline_to?: string
    page?: string
  }
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
]

const MEDICAL_NAICS_CODES = [
  { code: '334510', label: 'Electromedical and Electrotherapeutic Apparatus Manufacturing' },
  { code: '334516', label: 'Analytical Laboratory Instrument Manufacturing' },
  { code: '339112', label: 'Surgical and Medical Instrument Manufacturing' },
  { code: '339113', label: 'Surgical Appliance and Supplies Manufacturing' },
  { code: '339114', label: 'Dental Equipment and Supplies Manufacturing' },
  { code: '339115', label: 'Ophthalmic Goods Manufacturing' },
  { code: '339116', label: 'Dental Laboratories' },
  { code: '423450', label: 'Medical, Dental, and Hospital Equipment and Supplies Merchant Wholesalers' },
  { code: '446110', label: 'Pharmacies and Drug Stores' },
  { code: '621210', label: 'Offices of Dentists' },
  { code: '621310', label: 'Offices of Chiropractors' },
  { code: '621320', label: 'Offices of Optometrists' },
  { code: '621330', label: 'Offices of Mental Health Practitioners (except Physicians)' },
  { code: '621340', label: 'Offices of Physical, Occupational and Speech Therapists, and Audiologists' },
  { code: '621391', label: 'Offices of Podiatrists' },
  { code: '621399', label: 'Offices of All Other Miscellaneous Health Practitioners' },
  { code: '621410', label: 'Family Planning Centers' },
  { code: '621420', label: 'Outpatient Mental Health and Substance Abuse Centers' },
  { code: '621491', label: 'HMO Medical Centers' },
  { code: '621492', label: 'Kidney Dialysis Centers' },
  { code: '621493', label: 'Freestanding Ambulatory Surgical and Emergency Centers' },
  { code: '621498', label: 'All Other Outpatient Care Centers' },
  { code: '621511', label: 'Medical Laboratories' },
  { code: '621512', label: 'Diagnostic Imaging Centers' },
  { code: '621610', label: 'Home Health Care Services' },
  { code: '621910', label: 'Ambulance Services' },
  { code: '621991', label: 'Blood and Organ Banks' },
  { code: '621999', label: 'All Other Miscellaneous Ambulatory Health Care Services' },
  { code: '622110', label: 'General Medical and Surgical Hospitals' },
  { code: '622210', label: 'Psychiatric and Substance Abuse Hospitals' },
  { code: '622310', label: 'Specialty (except Psychiatric and Substance Abuse) Hospitals' },
  { code: '623110', label: 'Nursing Care Facilities (Skilled Nursing Facilities)' },
  { code: '623210', label: 'Residential Intellectual and Developmental Disability Facilities' },
  { code: '623220', label: 'Residential Mental Health and Substance Abuse Facilities' },
  { code: '623311', label: 'Continuing Care Retirement Communities' },
  { code: '623312', label: 'Assisted Living Facilities for the Elderly' },
  { code: '623990', label: 'Other Residential Care Facilities' }
]

const OPPORTUNITY_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' }
]

export function OpportunitiesFilters({ searchParams }: IOpportunitiesFiltersProps) {
  const router = useRouter()
  const currentSearchParams = useSearchParams()
  
  const [filters, setFilters] = useState({
    q: searchParams?.q || '',
    naics: searchParams?.naics || 'all',
    state: searchParams?.state || 'all',
    status: searchParams?.status || 'active',
    deadline_from: searchParams?.deadline_from || '',
    deadline_to: searchParams?.deadline_to || ''
  })

  const [hasActiveFilters, setHasActiveFilters] = useState(false)

  useEffect(() => {
    const hasFilters = Object.entries(filters).some(([key, value]) => 
      key !== 'status' && value.length > 0 && value !== 'all'
    ) || filters.status !== 'active'
    
    setHasActiveFilters(hasFilters)
  }, [filters])

  const updateURL = (newFilters: typeof filters) => {
    const params = new URLSearchParams()
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== 'all' && (key !== 'status' || value !== 'active')) {
        params.set(key, value)
      }
    })

    // Reset to page 1 when filters change
    params.delete('page')
    
    const query = params.toString()
    const url = query ? `/dashboard/opportunities?${query}` : '/dashboard/opportunities'
    router.push(url)
  }

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    updateURL(newFilters)
  }

  const handleSearch = () => {
    updateURL(filters)
  }

  const clearFilters = () => {
    const clearedFilters = {
      q: '',
      naics: 'all',
      state: 'all',
      status: 'active',
      deadline_from: '',
      deadline_to: ''
    }
    setFilters(clearedFilters)
    updateURL(clearedFilters)
  }

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0]
  }

  const getOneMonthFromNow = () => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    return date.toISOString().split('T')[0]
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="space-y-2">
        <Label htmlFor="search">Search</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search opportunities..."
            value={filters.q}
            onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} className="w-full" size="sm">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </div>

      {/* NAICS Code Filter */}
      <div className="space-y-2">
        <Label htmlFor="naics">Industry (NAICS)</Label>
        <Select
          value={filters.naics}
          onValueChange={(value: string) => handleFilterChange('naics', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select industry..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {MEDICAL_NAICS_CODES.map((naics) => (
              <SelectItem key={naics.code} value={naics.code}>
                {naics.code} - {naics.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* State Filter */}
      <div className="space-y-2">
        <Label htmlFor="state">State</Label>
        <Select
          value={filters.state}
          onValueChange={(value: string) => handleFilterChange('state', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select state..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={filters.status}
          onValueChange={(value: string) => handleFilterChange('status', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPPORTUNITY_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Range Filters */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deadline_from">Response Deadline From</Label>
          <Input
            id="deadline_from"
            type="date"
            value={filters.deadline_from}
            onChange={(e) => handleFilterChange('deadline_from', e.target.value)}
            min={getTodayDate()}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="deadline_to">Response Deadline To</Label>
          <Input
            id="deadline_to"
            type="date"
            value={filters.deadline_to}
            onChange={(e) => handleFilterChange('deadline_to', e.target.value)}
            min={filters.deadline_from || getTodayDate()}
          />
        </div>
      </div>

      {/* Quick Filters */}
      <div className="space-y-2">
        <Label>Quick Filters</Label>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = getTodayDate()
              const oneMonth = getOneMonthFromNow()
              setFilters(prev => ({
                ...prev,
                deadline_from: today,
                deadline_to: oneMonth,
                status: 'active'
              }))
            }}
            className="w-full justify-start"
          >
            <Filter className="mr-2 h-4 w-4" />
            Closing in 30 Days
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters(prev => ({
                ...prev,
                status: 'active'
              }))
            }}
            className="w-full justify-start"
          >
            <Filter className="mr-2 h-4 w-4" />
            Active Only
          </Button>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="w-full"
        >
          <X className="mr-2 h-4 w-4" />
          Clear All Filters
        </Button>
      )}
    </div>
  )
}