import { Suspense } from 'react'
import { CreateProposalContainer } from '@/components/dashboard/proposals/create-proposal-container'

export const metadata = {
  title: 'Create New Proposal | MedContractHub',
  description: 'Create a new federal contract proposal',
}

interface NewProposalPageProps {
  searchParams: Promise<{ 
    opportunity_id?: string 
  }>
}

export default async function NewProposalPage({ 
  searchParams 
}: NewProposalPageProps) {
  const params = await searchParams
  const opportunityId = params.opportunity_id

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Create New Proposal
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {opportunityId 
            ? 'Create a proposal for the selected opportunity'
            : 'Start by selecting an opportunity or create a custom proposal'
          }
        </p>
      </div>
      
      <Suspense fallback={<div>Loading...</div>}>
        <CreateProposalContainer opportunityId={opportunityId} />
      </Suspense>
    </div>
  )
}