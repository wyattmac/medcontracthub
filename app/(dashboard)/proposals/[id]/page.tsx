import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ProposalDetailContainer } from '@/components/dashboard/proposals/proposal-detail-container'

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  
  return {
    title: `Proposal ${id} | MedContractHub`,
    description: 'View and edit proposal details',
  }
}

interface ProposalDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ProposalDetailPage({ 
  params 
}: ProposalDetailPageProps) {
  const { id } = await params

  if (!id) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<div>Loading proposal...</div>}>
        <ProposalDetailContainer proposalId={id} />
      </Suspense>
    </div>
  )
}