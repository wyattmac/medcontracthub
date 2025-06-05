'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { 
  Calendar, 
  DollarSign, 
  FileText, 
  MoreHorizontal,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Proposal {
  id: string
  title: string
  status: string
  created_at: string
  submission_deadline?: string
  total_proposed_price?: number
  win_probability?: number
  opportunities: {
    id: string
    title: string
    agency: string
    solicitation_number?: string
  }
  proposal_sections: Array<{
    id: string
    section_type: string
    word_count?: number
  }>
}

interface ProposalsListProps {
  proposals: Proposal[]
  pagination?: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
  isLoading: boolean
  onPageChange: (offset: number) => void
  onRefresh: () => void
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

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const status = statusConfig[proposal.status as keyof typeof statusConfig] || statusConfig.draft
  const StatusIcon = status.icon

  const totalWordCount = proposal.proposal_sections.reduce(
    (sum, section) => sum + (section.word_count || 0), 
    0
  )

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <Link 
              href={`/proposals/${proposal.id}`}
              className="block hover:text-blue-600 dark:hover:text-blue-400"
            >
              <h3 className="font-semibold text-lg leading-6 truncate">
                {proposal.title}
              </h3>
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {proposal.opportunities.agency} • {proposal.opportunities.title}
            </p>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/proposals/${proposal.id}`}>
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/proposals/${proposal.id}/edit`}>
                    Edit Proposal
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  Delete Proposal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <div>
              <div className="text-gray-600 dark:text-gray-400">Created</div>
              <div className="font-medium">
                {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}
              </div>
            </div>
          </div>
          
          {proposal.submission_deadline && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <div className="text-gray-600 dark:text-gray-400">Deadline</div>
                <div className="font-medium">
                  {formatDistanceToNow(new Date(proposal.submission_deadline), { addSuffix: true })}
                </div>
              </div>
            </div>
          )}
          
          {proposal.total_proposed_price && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <div>
                <div className="text-gray-600 dark:text-gray-400">Value</div>
                <div className="font-medium">
                  ${proposal.total_proposed_price.toLocaleString()}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <div>
              <div className="text-gray-600 dark:text-gray-400">Content</div>
              <div className="font-medium">
                {proposal.proposal_sections.length} sections
                {totalWordCount > 0 && ` • ${totalWordCount.toLocaleString()} words`}
              </div>
            </div>
          </div>
        </div>
        
        {proposal.win_probability && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Win Probability</span>
              <span className="font-medium">{Math.round(proposal.win_probability * 100)}%</span>
            </div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${proposal.win_probability * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ProposalsList({ 
  proposals, 
  pagination, 
  isLoading, 
  onPageChange 
}: ProposalsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No proposals found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Get started by creating your first proposal from an opportunity.
            </p>
            <Link href="/dashboard/proposals/new">
              <Button>Create Your First Proposal</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
      
      {pagination && pagination.total > pagination.limit && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} proposals
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(0, pagination.offset - pagination.limit))}
              disabled={pagination.offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.offset + pagination.limit)}
              disabled={!pagination.has_more}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}