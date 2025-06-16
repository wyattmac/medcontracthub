import { Suspense } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { OpportunitiesContainer } from '@/components/dashboard/opportunities/opportunities-container'
import { OpportunitiesLayout } from '@/components/dashboard/opportunities/opportunities-layout'
import { OpportunitiesStats } from '@/components/dashboard/opportunities/opportunities-stats'
import { SectionErrorBoundary } from '@/components/ui/error-boundary'
import { PerformanceIndicator } from '@/components/dashboard/opportunities/performance-indicator'
import { TrendingUp, Zap, Database, RefreshCw } from 'lucide-react'

// Force dynamic rendering since this page shows user-specific data
export const dynamic = 'force-dynamic'
export const revalidate = 60 // Revalidate every minute for better performance

interface OpportunitiesPageProps {
  searchParams?: Promise<{
    q?: string
    naics?: string
    state?: string
    status?: string
    deadline_from?: string
    deadline_to?: string
    page?: string
  }>
}

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const params = await searchParams
  return (
    <OpportunitiesLayout searchParams={params}>
      {/* Enhanced Page Header */}
      <div className="space-y-4">
        <h1 
          className="text-4xl font-bold animate-pulse"
          style={{
            background: 'linear-gradient(to right, #2563eb, #059669, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          🔍 Federal Contract Opportunities
        </h1>
        <p className="text-lg text-muted-foreground max-w-4xl">
          Live federal medical supply contracts from <strong>SAM.gov</strong> tailored to your capabilities. 
          Real-time data powered by AI matching for optimal results.
        </p>
        
        {/* Status Indicators */}
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>SAM.gov API Active</span>
          </div>
          <div className="flex items-center gap-2 text-blue-600">
            <Database className="h-4 w-4" />
            <span>24K+ Opportunities</span>
          </div>
          <div className="flex items-center gap-2 text-purple-600">
            <Zap className="h-4 w-4" />
            <span>AI-Powered Matching</span>
          </div>
        </div>
      </div>


      {/* Live Opportunities Container */}
      <SectionErrorBoundary name="Opportunities List">
        <Suspense fallback={<OpportunitiesLoadingSkeleton />}>
          <OpportunitiesContainer searchParams={params} />
        </Suspense>
      </SectionErrorBoundary>

      
      {/* Performance Indicator (Development Only) */}
      <PerformanceIndicator />
    </OpportunitiesLayout>
  )
}

// Loading Skeletons
function StatsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="pb-2">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-8 bg-gray-300 rounded w-16"></div>
          </CardHeader>
          <CardContent>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function OpportunitiesLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="flex gap-2">
          <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="flex justify-between">
              <div className="flex-1 space-y-3">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="flex gap-4">
                  <div className="h-4 bg-gray-100 rounded w-32"></div>
                  <div className="h-4 bg-gray-100 rounded w-24"></div>
                  <div className="h-4 bg-gray-100 rounded w-28"></div>
                </div>
                <div className="h-4 bg-gray-100 rounded w-full"></div>
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-100 rounded w-20"></div>
                  <div className="h-6 bg-gray-100 rounded w-24"></div>
                </div>
              </div>
              <div className="flex flex-col gap-2 ml-4">
                <div className="h-8 bg-gray-200 rounded w-24"></div>
                <div className="h-8 bg-gray-100 rounded w-24"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}