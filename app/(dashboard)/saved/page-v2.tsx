/**
 * Saved Opportunities Page V2 - Production Ready
 * Works in both development and production environments
 */

import { Suspense } from 'react'
import { SavedOpportunitiesContainer } from '@/components/dashboard/saved/saved-opportunities-container-v2'
import { SectionErrorBoundary } from '@/components/ui/error-boundary'

export default function SavedOpportunitiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Saved Opportunities</h1>
        <p className="text-muted-foreground">
          Manage your saved opportunities, notes, and reminders
        </p>
      </div>

      <SectionErrorBoundary name="Saved Opportunities">
        <Suspense fallback={<SavedOpportunitiesLoading />}>
          <SavedOpportunitiesContainer />
        </Suspense>
      </SectionErrorBoundary>
    </div>
  )
}

function SavedOpportunitiesLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="border rounded-lg p-6 space-y-3 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-100 rounded w-1/2"></div>
          <div className="flex gap-2">
            <div className="h-6 bg-gray-100 rounded w-20"></div>
            <div className="h-6 bg-gray-100 rounded w-24"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export const metadata = {
  title: 'Saved Opportunities | MedContractHub',
  description: 'Manage your saved government contract opportunities, notes, and tracking information.',
}