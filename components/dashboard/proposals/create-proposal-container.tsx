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
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    Selected Opportunity
                  </div>
                  <button
                    onClick={() => setSelectedOpportunityId(undefined)}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Change
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 line-clamp-2">
                    {opportunityData.opportunity.title}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Agency:</strong> {opportunityData.opportunity.agency}
                      </p>
                      {opportunityData.opportunity.solicitation_number && (
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>Solicitation:</strong> {opportunityData.opportunity.solicitation_number}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Deadline:</strong>{' '}
                        {new Date(opportunityData.opportunity.response_deadline).toLocaleDateString()}
                      </p>
                      {opportunityData.opportunity.naics_code && (
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>NAICS:</strong> {opportunityData.opportunity.naics_code}
                        </p>
                      )}
                    </div>
                  </div>
                  {opportunityData.opportunity.additional_info && 
                   (opportunityData.opportunity.additional_info as any)?.resourceLinks?.length > 0 && (
                    <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        📄 {(opportunityData.opportunity.additional_info as any).resourceLinks.length} document(s) available for OCR analysis
                      </p>
                    </div>
                  )}
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