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
import { Search, X, Filter, Stethoscope } from 'lucide-react'
import { getMedicalNAICSGrouped, getSpecificMedicalNAICS } from '@/lib/constants/medical-naics'

interface IOpportunitiesFiltersProps {
  searchParams?: {
    q?: string
    naics?: string
    state?: string
    status?: string
    set_aside?: string
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

// Get medical NAICS codes from our comprehensive reference
const MEDICAL_NAICS_CODES = getSpecificMedicalNAICS().map(naics => ({
  code: naics.code,
  label: naics.title,
  category: naics.category
}))

// Group NAICS codes by category for better organization
const MEDICAL_NAICS_GROUPED = getMedicalNAICSGrouped()

const OPPORTUNITY_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' }
]

const SET_ASIDE_TYPES = [
  { value: 'all', label: 'All Opportunities' },
  { value: 'NONE', label: 'No Set-Aside (Full & Open)' },
  { value: 'SBA', label: 'Small Business Set-Aside' },
  { value: 'SDVOSBC', label: 'Service-Disabled Veteran-Owned Small Business' },
  { value: 'VOSB', label: 'Veteran-Owned Small Business' },
  { value: 'WOSB', label: 'Women-Owned Small Business' },
  { value: 'EDWOSB', label: 'Economically Disadvantaged Women-Owned Small Business' },
  { value: '8A', label: '8(a) Business Development Program' },
  { value: 'HUBZone', label: 'HUBZone Small Business' },
  { value: 'ISBEE', label: 'Indian Small Business Economic Enterprise' },
  { value: 'IEE', label: 'Indian Economic Enterprise' },
  { value: 'NATIVE', label: 'Native American Owned' },
  { value: 'SDB', label: 'Small Disadvantaged Business' }
]

export function OpportunitiesFilters({ searchParams }: IOpportunitiesFiltersProps) {
  const router = useRouter()
  const currentSearchParams = useSearchParams()
  
  const [filters, setFilters] = useState({
    q: searchParams?.q || '',
    naics: searchParams?.naics || 'all',
    state: searchParams?.state || 'all',
    status: searchParams?.status || 'active',
    set_aside: searchParams?.set_aside || 'all',
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
    const url = query ? `/opportunities?${query}` : '/opportunities'
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
      set_aside: 'all',
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

      {/* NAICS Code Filter - Enhanced with Medical Categories */}
      <div className="space-y-2">
        <Label htmlFor="naics" className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-blue-600" />
          Medical Industry (NAICS)
        </Label>
        <Select
          value={filters.naics}
          onValueChange={(value: string) => handleFilterChange('naics', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select medical industry..." />
          </SelectTrigger>
          <SelectContent className="max-h-96">
            <SelectItem value="all">All Medical Industries</SelectItem>
            
            {/* Manufacturing */}
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
              Manufacturing
            </div>
            {MEDICAL_NAICS_GROUPED.manufacturing?.map((naics) => (
              <SelectItem key={naics.code} value={naics.code} className="pl-4">
                {naics.code} - {naics.title}
              </SelectItem>
            ))}
            
            {/* Wholesale */}
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
              Wholesale & Distribution
            </div>
            {MEDICAL_NAICS_GROUPED.wholesale?.map((naics) => (
              <SelectItem key={naics.code} value={naics.code} className="pl-4">
                {naics.code} - {naics.title}
              </SelectItem>
            ))}
            
            {/* Healthcare Services */}
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
              Healthcare Services
            </div>
            {MEDICAL_NAICS_GROUPED.healthcare?.slice(0, 20).map((naics) => (
              <SelectItem key={naics.code} value={naics.code} className="pl-4">
                {naics.code} - {naics.title}
              </SelectItem>
            ))}
            
            {/* Research & Development */}
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
              Research & Development
            </div>
            {MEDICAL_NAICS_GROUPED.research?.map((naics) => (
              <SelectItem key={naics.code} value={naics.code} className="pl-4">
                {naics.code} - {naics.title}
              </SelectItem>
            ))}
            
            {/* Retail */}
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
              Retail & Services
            </div>
            {MEDICAL_NAICS_GROUPED.retail?.map((naics) => (
              <SelectItem key={naics.code} value={naics.code} className="pl-4">
                {naics.code} - {naics.title}
              </SelectItem>
            ))}
            {MEDICAL_NAICS_GROUPED.services?.map((naics) => (
              <SelectItem key={naics.code} value={naics.code} className="pl-4">
                {naics.code} - {naics.title}
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

      {/* Set-Aside Filter */}
      <div className="space-y-2">
        <Label htmlFor="set_aside">Set-Aside Type</Label>
        <Select
          value={filters.set_aside}
          onValueChange={(value: string) => handleFilterChange('set_aside', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select set-aside type..." />
          </SelectTrigger>
          <SelectContent>
            {SET_ASIDE_TYPES.map((setAside) => (
              <SelectItem key={setAside.value} value={setAside.value}>
                {setAside.label}
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

      {/* Quick Filters - Medical Focused */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Quick Medical Filters
        </Label>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newFilters = {
                ...filters,
                naics: '423450', // Medical Equipment Wholesalers
                status: 'active'
              }
              setFilters(newFilters)
              updateURL(newFilters)
            }}
            className="w-full justify-start"
          >
            <Stethoscope className="mr-2 h-4 w-4 text-blue-600" />
            Medical Equipment
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newFilters = {
                ...filters,
                naics: '325412', // Pharmaceutical Manufacturing
                status: 'active'
              }
              setFilters(newFilters)
              updateURL(newFilters)
            }}
            className="w-full justify-start"
          >
            <Stethoscope className="mr-2 h-4 w-4 text-green-600" />
            Pharmaceuticals
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newFilters = {
                ...filters,
                naics: '622110', // Hospitals
                status: 'active'
              }
              setFilters(newFilters)
              updateURL(newFilters)
            }}
            className="w-full justify-start"
          >
            <Stethoscope className="mr-2 h-4 w-4 text-red-600" />
            Hospital Services
          </Button>
          
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
              const newFilters = {
                ...filters,
                set_aside: 'SBA',
                status: 'active'
              }
              setFilters(newFilters)
              updateURL(newFilters)
            }}
            className="w-full justify-start"
          >
            <Filter className="mr-2 h-4 w-4" />
            Small Business Set-Asides
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