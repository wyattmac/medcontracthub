'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateProposalForm } from './create-proposal-form'
import { OpportunitySelector } from './opportunity-selector'

interface CreateProposalContainerProps {
  opportunityId?: string
}

async function fetchOpportunity(id: string) {
  const response = await fetch(`/api/opportunities/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch opportunity')
  }
  return response.json()
}

async function createProposal(data: any) {
  const response = await fetch('/api/proposals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create proposal')
  }
  
  return response.json()
}

export function CreateProposalContainer({ opportunityId }: CreateProposalContainerProps) {
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(opportunityId)
  const router = useRouter()
  const queryClient = useQueryClient()

  // Fetch opportunity details if ID is provided
  const { data: opportunityData, isLoading: opportunityLoading } = useQuery({
    queryKey: ['opportunity', selectedOpportunityId],
    queryFn: () => fetchOpportunity(selectedOpportunityId!),
    enabled: !!selectedOpportunityId,
  })

  // Create proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: createProposal,
    onSuccess: (data) => {
      // Invalidate and refetch proposals
      queryClient.invalidateQueries({ queryKey: ['proposals'] })
      
      // Redirect to the new proposal
      router.push(`/proposals/${data.proposal.id}`)
    },
  })

  const handleOpportunitySelect = (opportunityId: string) => {
    setSelectedOpportunityId(opportunityId)
  }

  const handleCreateProposal = (proposalData: any) => {
    createProposalMutation.mutate({
      ...proposalData,
      opportunity_id: selectedOpportunityId,
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!selectedOpportunityId ? (
        <Card>
          <CardHeader>
            <CardTitle>Select an Opportunity</CardTitle>
          </CardHeader>
          <CardContent>
            <OpportunitySelector onSelect={handleOpportunitySelect} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Opportunity Summary */}
          {opportunityData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Selected Opportunity
                  <button
                    onClick={() => setSelectedOpportunityId(undefined)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Change
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h3 className="font-semibold">{opportunityData.opportunity.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {opportunityData.opportunity.agency}
                  </p>
                  {opportunityData.opportunity.solicitation_number && (
                    <p className="text-sm">
                      <strong>Solicitation:</strong> {opportunityData.opportunity.solicitation_number}
                    </p>
                  )}
                  <p className="text-sm">
                    <strong>Deadline:</strong>{' '}
                    {new Date(opportunityData.opportunity.response_deadline).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Proposal Creation Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create Proposal</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateProposalForm
                opportunity={opportunityData?.opportunity}
                onSubmit={handleCreateProposal}
                isLoading={createProposalMutation.isPending}
                error={createProposalMutation.error?.message}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}