/**
 * Opportunities Page - Browse and search federal contract opportunities
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import { OpportunitiesContainer } from '@/components/dashboard/opportunities/opportunities-container'
import { OpportunitiesFilters } from '@/components/dashboard/opportunities/opportunities-filters'
import { OpportunitiesList } from '@/components/dashboard/opportunities/opportunities-list'
import { OpportunitiesStats } from '@/components/dashboard/opportunities/opportunities-stats'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Contract Opportunities | MedContractHub',
  description: 'Discover and track federal medical supply contract opportunities from SAM.gov',
}

interface IOpportunitiesPageProps {
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

export default function OpportunitiesPage({ searchParams }: IOpportunitiesPageProps) {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Contract Opportunities</h1>
        <p className="text-muted-foreground">
          Discover federal medical supply contracts from SAM.gov tailored to your company&apos;s capabilities
        </p>
      </div>

      {/* Stats Overview */}
      <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded-lg" />}>
        <OpportunitiesStats />
      </Suspense>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>
                Refine your opportunity search
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>}>
                <OpportunitiesFilters searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </aside>

        {/* Opportunities List */}
        <main className="lg:col-span-3">
          <Suspense fallback={<div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-4 bg-muted animate-pulse rounded w-full" />
                    <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                    <div className="flex space-x-2">
                      <div className="h-8 bg-muted animate-pulse rounded w-20" />
                      <div className="h-8 bg-muted animate-pulse rounded w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>}>
            <OpportunitiesContainer searchParams={searchParams} />
          </Suspense>
        </main>
      </div>
    </div>
  )
}