import { Suspense } from 'react'
import { ProposalsContainer } from '@/components/dashboard/proposals/proposals-container'

export const metadata = {
  title: 'Proposals | MedContractHub',
  description: 'Manage your federal contract proposals and submissions',
}

export default function ProposalsPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Proposals
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create, manage, and track your federal contract proposals
          </p>
        </div>
      </div>
      
      <Suspense fallback={<div>Loading proposals...</div>}>
        <ProposalsContainer />
      </Suspense>
    </div>
  )
}