'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  Building, 
  ExternalLink,
  Edit,
  Trash2,
  Save,
  Plus,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

interface ProposalDetailContainerProps {
  proposalId: string
}

async function fetchProposal(id: string) {
  const response = await fetch(`/api/proposals/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch proposal')
  }
  return response.json()
}

async function deleteProposal(id: string) {
  const response = await fetch(`/api/proposals/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete proposal')
  }
  return response.json()
}

const statusConfig = {
  draft: { 
    label: 'Draft', 
    icon: Clock, 
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
  },
  submitted: { 
    label: 'Submitted', 
    icon: FileText, 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
  },
  under_review: { 
    label: 'Under Review', 
    icon: AlertCircle, 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
  },
  awarded: { 
    label: 'Awarded', 
    icon: CheckCircle, 
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
  },
  rejected: { 
    label: 'Rejected', 
    icon: XCircle, 
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
  },
  withdrawn: { 
    label: 'Withdrawn', 
    icon: XCircle, 
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' 
  }
}

export function ProposalDetailContainer({ proposalId }: ProposalDetailContainerProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: () => fetchProposal(proposalId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const deleteProposalMutation = useMutation({
    mutationFn: deleteProposal,
    onSuccess: () => {
      toast.success('Proposal deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['proposals'] })
      router.push('/proposals')
    },
    onError: (error) => {
      toast.error(`Failed to delete proposal: ${error.message}`)
    },
  })

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this proposal? This action cannot be undone.')) {
      deleteProposalMutation.mutate(proposalId)
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
        <div className="h-96 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400">
              Error loading proposal: {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <Button 
              onClick={() => router.push('/proposals')} 
              variant="outline" 
              className="mt-4"
            >
              Back to Proposals
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data?.proposal) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Proposal not found</p>
            <Button 
              onClick={() => router.push('/proposals')} 
              variant="outline" 
              className="mt-4"
            >
              Back to Proposals
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const proposal = data.proposal
  const opportunity = proposal.opportunities
  const status = statusConfig[proposal.status as keyof typeof statusConfig] || statusConfig.draft
  const StatusIcon = status.icon

  const totalWordCount = proposal.proposal_sections?.reduce(
    (sum: number, section: any) => sum + (section.word_count || 0), 
    0
  ) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {proposal.title}
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Created {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDelete}
            disabled={deleteProposalMutation.isPending}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Building className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Agency</p>
                <p className="font-semibold">{opportunity.agency}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {proposal.submission_deadline && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Deadline</p>
                  <p className="font-semibold">
                    {formatDistanceToNow(new Date(proposal.submission_deadline), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {proposal.total_proposed_price && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Proposed Value</p>
                  <p className="font-semibold">${proposal.total_proposed_price.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Content</p>
                <p className="font-semibold">
                  {proposal.proposal_sections?.length || 0} sections
                  {totalWordCount > 0 && ` • ${totalWordCount.toLocaleString()} words`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Win Probability */}
      {proposal.win_probability && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Win Probability</span>
              <span className="text-lg font-bold">{Math.round(proposal.win_probability * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                style={{ width: `${proposal.win_probability * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
          <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Opportunity Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Opportunity Details
                {opportunity.sam_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={opportunity.sam_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View on SAM.gov
                    </a>
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold">{opportunity.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {opportunity.description}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {opportunity.solicitation_number && (
                  <div>
                    <span className="font-medium">Solicitation Number:</span>
                    <span className="ml-2">{opportunity.solicitation_number}</span>
                  </div>
                )}
                
                {opportunity.naics_code && (
                  <div>
                    <span className="font-medium">NAICS Code:</span>
                    <span className="ml-2">{opportunity.naics_code}</span>
                  </div>
                )}
                
                {opportunity.naics_description && (
                  <div className="md:col-span-2">
                    <span className="font-medium">NAICS Description:</span>
                    <span className="ml-2">{opportunity.naics_description}</span>
                  </div>
                )}
                
                {(opportunity.estimated_value_min || opportunity.estimated_value_max) && (
                  <div>
                    <span className="font-medium">Estimated Value:</span>
                    <span className="ml-2">
                      {opportunity.estimated_value_min && opportunity.estimated_value_max ? (
                        `$${opportunity.estimated_value_min.toLocaleString()} - $${opportunity.estimated_value_max.toLocaleString()}`
                      ) : opportunity.estimated_value_max ? (
                        `Up to $${opportunity.estimated_value_max.toLocaleString()}`
                      ) : (
                        `From $${opportunity.estimated_value_min.toLocaleString()}`
                      )}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Proposal Summary */}
          {proposal.proposal_summary && (
            <Card>
              <CardHeader>
                <CardTitle>Proposal Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {proposal.proposal_summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {proposal.tags && proposal.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {proposal.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {proposal.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {proposal.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sections">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Proposal Sections
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Section
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {proposal.proposal_sections && proposal.proposal_sections.length > 0 ? (
                <div className="space-y-4">
                  {proposal.proposal_sections
                    .sort((a: any, b: any) => a.sort_order - b.sort_order)
                    .map((section: any) => (
                    <div key={section.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{section.title}</h4>
                        <div className="flex items-center gap-2">
                          {section.is_required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                          {section.ai_generated && (
                            <Badge variant="secondary" className="text-xs">AI Generated</Badge>
                          )}
                          <Button size="sm" variant="outline">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <span>Type: {section.section_type.replace('_', ' ')}</span>
                        {section.word_count && <span>Words: {section.word_count.toLocaleString()}</span>}
                        {section.max_pages && <span>Max Pages: {section.max_pages}</span>}
                      </div>
                      
                      {section.content && (
                        <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                          {section.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No sections added yet</p>
                  <Button className="mt-4">Add Your First Section</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Attachments
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Upload File
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                No attachments uploaded yet
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collaboration">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Collaborators
                <Button size="sm">
                  <User className="h-4 w-4 mr-1" />
                  Invite
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {proposal.proposal_collaborators && proposal.proposal_collaborators.length > 0 ? (
                <div className="space-y-3">
                  {proposal.proposal_collaborators.map((collab: any) => (
                    <div key={collab.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{collab.profiles.full_name || collab.profiles.email}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{collab.role}</p>
                      </div>
                      <Badge variant="outline">{collab.role}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                  No collaborators added yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Submission History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                No submissions recorded yet
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}