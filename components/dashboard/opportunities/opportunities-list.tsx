/**
 * Opportunities List - Display opportunities with match scores and key info
 */

'use client'

import Link from 'next/link'
import { Database } from '@/types/database.types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDeadline } from '@/lib/sam-gov/utils'
import { SaveOpportunityButton } from './save-opportunity-button'
import { MarkForProposalButton } from './mark-for-proposal-button'
import { 
  Calendar, 
  MapPin, 
  Building2, 
  DollarSign, 
  Target,
  ExternalLink
} from 'lucide-react'

type OpportunityWithMatch = Database['public']['Tables']['opportunities']['Row'] & {
  matchScore: number
  isSaved: boolean
}

interface IOpportunitiesListProps {
  opportunities: OpportunityWithMatch[]
  isLoading: boolean
}

export function OpportunitiesList({ opportunities, isLoading }: IOpportunitiesListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <OpportunityCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {opportunities.map((opportunity) => (
        <OpportunityCard key={opportunity.id} opportunity={opportunity} />
      ))}
    </div>
  )
}

function OpportunityCard({ opportunity }: { opportunity: OpportunityWithMatch }) {
  const deadline = formatDeadline(opportunity.response_deadline)
  
  // Determine match score color and label
  const getMatchBadge = (score: number) => {
    if (score >= 0.8) {
      return { variant: 'default' as const, label: 'Excellent Match', color: 'bg-green-500' }
    } else if (score >= 0.6) {
      return { variant: 'secondary' as const, label: 'Good Match', color: 'bg-blue-500' }
    } else if (score >= 0.4) {
      return { variant: 'outline' as const, label: 'Fair Match', color: 'bg-yellow-500' }
    } else {
      return { variant: 'outline' as const, label: 'Low Match', color: 'bg-gray-400' }
    }
  }

  const matchBadge = getMatchBadge(opportunity.matchScore)

  // Determine urgency styling for deadline
  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={matchBadge.variant} className="shrink-0">
                <Target className="w-3 h-3 mr-1" />
                {Math.round(opportunity.matchScore * 100)}% Match
              </Badge>
              <div className={`w-2 h-2 rounded-full ${matchBadge.color}`} />
              <span className="text-xs text-muted-foreground">{matchBadge.label}</span>
            </div>
            
            <Link 
              href={`/opportunities/${opportunity.id}`}
              className="group"
            >
              <h3 className="text-lg font-semibold leading-tight group-hover:text-primary transition-colors line-clamp-2">
                {opportunity.title}
              </h3>
            </Link>
            
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {opportunity.description}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <MarkForProposalButton 
              opportunity={opportunity}
            />
            
            <SaveOpportunityButton 
              opportunityId={opportunity.id}
              isSaved={opportunity.isSaved}
              opportunityData={opportunity}
            />
            
            {opportunity.sam_url && (
              <Button variant="ghost" size="sm" asChild>
                <a 
                  href={opportunity.sam_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  title="View on SAM.gov"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Agency */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Agency</p>
              <p className="text-sm font-medium truncate" title={opportunity.agency}>
                {opportunity.agency}
              </p>
            </div>
          </div>

          {/* Location */}
          {(opportunity.place_of_performance_city || opportunity.place_of_performance_state) && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm font-medium truncate">
                  {[opportunity.place_of_performance_city, opportunity.place_of_performance_state]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Estimated Value */}
          {(opportunity.estimated_value_min || opportunity.estimated_value_max) && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Est. Value</p>
                <p className="text-sm font-medium truncate">
                  {opportunity.estimated_value_min && opportunity.estimated_value_max ? (
                    `${formatCurrency(opportunity.estimated_value_min)} - ${formatCurrency(opportunity.estimated_value_max)}`
                  ) : (
                    formatCurrency(opportunity.estimated_value_max || opportunity.estimated_value_min)
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Response Deadline */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Deadline</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">
                  {deadline.formatted}
                </p>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getUrgencyStyle(deadline.urgency)}`}
                >
                  {deadline.daysRemaining >= 0 ? `${deadline.daysRemaining}d` : 'Expired'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Tags and Metadata */}
        <div className="flex flex-wrap gap-2">
          {opportunity.naics_code && (
            <Badge variant="outline" className="text-xs">
              NAICS {opportunity.naics_code}
            </Badge>
          )}
          
          {opportunity.set_aside_type && (
            <Badge variant="outline" className="text-xs">
              {opportunity.set_aside_type}
            </Badge>
          )}
          
          {opportunity.solicitation_number && (
            <Badge variant="outline" className="text-xs">
              {opportunity.solicitation_number}
            </Badge>
          )}

          <Badge 
            variant={opportunity.status === 'active' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {opportunity.status.charAt(0).toUpperCase() + opportunity.status.slice(1)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function OpportunityCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-20 bg-muted animate-pulse rounded" />
            <div className="h-2 w-2 bg-muted animate-pulse rounded-full" />
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 w-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}