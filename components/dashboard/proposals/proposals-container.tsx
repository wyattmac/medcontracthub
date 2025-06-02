'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProposalsList } from './proposals-list'
import { ProposalsFilters } from './proposals-filters'
import { ProposalsStats } from './proposals-stats'

interface ProposalsData {
  proposals: any[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

async function fetchProposals(params: {
  status?: string
  limit?: number
  offset?: number
}): Promise<ProposalsData> {
  const searchParams = new URLSearchParams()
  
  if (params.status) searchParams.set('status', params.status)
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.offset) searchParams.set('offset', params.offset.toString())

  const response = await fetch(`/api/proposals?${searchParams}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch proposals')
  }
  
  return response.json()
}

export function ProposalsContainer() {
  const [filters, setFilters] = useState({
    status: '',
    limit: 10,
    offset: 0
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['proposals', filters],
    queryFn: () => fetchProposals(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, offset: 0 }))
  }

  const handlePageChange = (newOffset: number) => {
    setFilters(prev => ({ ...prev, offset: newOffset }))
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400">
              Error loading proposals: {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <ProposalsStats proposals={data?.proposals || []} />

      {/* Filters and Create Button */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <ProposalsFilters 
          filters={filters}
          onFilterChange={handleFilterChange}
        />
        
        <Link href="/dashboard/proposals/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Proposal
          </Button>
        </Link>
      </div>

      {/* Proposals List */}
      <ProposalsList
        proposals={data?.proposals || []}
        pagination={data?.pagination}
        isLoading={isLoading}
        onPageChange={handlePageChange}
        onRefresh={refetch}
      />
    </div>
  )
}