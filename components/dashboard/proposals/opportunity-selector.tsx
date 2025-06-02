'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Calendar, Building, DollarSign } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface OpportunitySelectorProps {
  onSelect: (opportunityId: string) => void
}

async function fetchOpportunities(params: {
  search?: string
  limit?: number
  offset?: number
}) {
  const searchParams = new URLSearchParams()
  
  if (params.search) searchParams.set('search', params.search)
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.offset) searchParams.set('offset', params.offset.toString())

  const response = await fetch(`/api/opportunities/search?${searchParams}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch opportunities')
  }
  
  return response.json()
}

export function OpportunitySelector({ onSelect }: OpportunitySelectorProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['opportunities', { search: debouncedSearch, limit: 20 }],
    queryFn: () => fetchOpportunities({ 
      search: debouncedSearch || undefined, 
      limit: 20 
    }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search opportunities by title, agency, or solicitation number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {error && (
        <div className="text-center text-red-600 dark:text-red-400">
          Error loading opportunities: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {data.opportunities.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No opportunities found. Try adjusting your search terms.
            </div>
          ) : (
            data.opportunities.map((opportunity: any) => (
              <Card 
                key={opportunity.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onSelect(opportunity.id)}
              >
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-sm leading-5 line-clamp-2">
                        {opportunity.title}
                      </h3>
                      <Button size="sm" className="ml-2 shrink-0">
                        Select
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {opportunity.agency}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due {formatDistanceToNow(new Date(opportunity.response_deadline), { addSuffix: true })}
                      </div>
                      
                      {(opportunity.estimated_value_min || opportunity.estimated_value_max) && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {opportunity.estimated_value_min && opportunity.estimated_value_max ? (
                            `$${(opportunity.estimated_value_min / 1000).toFixed(0)}K - $${(opportunity.estimated_value_max / 1000).toFixed(0)}K`
                          ) : opportunity.estimated_value_max ? (
                            `Up to $${(opportunity.estimated_value_max / 1000).toFixed(0)}K`
                          ) : (
                            `From $${(opportunity.estimated_value_min / 1000).toFixed(0)}K`
                          )}
                        </div>
                      )}
                    </div>

                    {opportunity.solicitation_number && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {opportunity.solicitation_number}
                        </Badge>
                        {opportunity.naics_code && (
                          <Badge variant="outline" className="text-xs">
                            NAICS {opportunity.naics_code}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {opportunity.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {opportunity.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}