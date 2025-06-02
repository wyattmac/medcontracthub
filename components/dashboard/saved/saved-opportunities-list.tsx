/**
 * Saved Opportunities List - Display saved opportunities with enhanced tracking
 */

'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDeadline } from '@/lib/sam-gov/utils'
import { SaveOpportunityButton } from '../opportunities/save-opportunity-button'
import { EditOpportunityNotesModal } from '../opportunities/edit-opportunity-notes-modal'
import { 
  Calendar, 
  MapPin, 
  Building2, 
  DollarSign, 
  Target,
  ExternalLink,
  Clock,
  Eye,
  Edit3,
  AlertTriangle
} from 'lucide-react'
import { format, isAfter, isBefore } from 'date-fns'

interface ISavedOpportunitiesListProps {
  opportunities: any[]
  isLoading: boolean
  onUpdate: () => void
}

export function SavedOpportunitiesList({ opportunities, isLoading, onUpdate }: ISavedOpportunitiesListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <SavedOpportunityCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {opportunities.map((savedOpp) => (
        <SavedOpportunityCard 
          key={savedOpp.id} 
          savedOpportunity={savedOpp} 
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}

function SavedOpportunityCard({ 
  savedOpportunity, 
  onUpdate 
}: { 
  savedOpportunity: any
  onUpdate: () => void 
}) {
  const { opportunity } = savedOpportunity
  const deadline = formatDeadline(opportunity.response_deadline)
  
  // Check if reminder is due soon
  const reminderDueSoon = savedOpportunity.reminder_date && 
    new Date(savedOpportunity.reminder_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  
  // Determine match score color and label
  const getMatchBadge = (score: number) => {
    if (score >= 80) {
      return { variant: 'default' as const, label: 'Excellent Match', color: 'bg-green-500' }
    } else if (score >= 60) {
      return { variant: 'secondary' as const, label: 'Good Match', color: 'bg-blue-500' }
    } else if (score >= 40) {
      return { variant: 'outline' as const, label: 'Fair Match', color: 'bg-yellow-500' }
    } else {
      return { variant: 'outline' as const, label: 'Low Match', color: 'bg-gray-400' }
    }
  }

  const matchBadge = getMatchBadge(opportunity.matchScore * 100)

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
              
              {/* Pursuing indicator */}
              {savedOpportunity.is_pursuing && (
                <Badge variant="default" className="text-xs">
                  Pursuing
                </Badge>
              )}
              
              {/* Reminder indicator */}
              {savedOpportunity.reminder_date && (
                <Badge 
                  variant={reminderDueSoon ? "destructive" : "outline"} 
                  className="text-xs"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Reminder
                </Badge>
              )}
            </div>
            
            <Link 
              href={`/dashboard/opportunities/${opportunity.id}`}
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
            <EditOpportunityNotesModal 
              opportunityId={opportunity.id}
              opportunity={{
                title: opportunity.title,
                saved_opportunities: [savedOpportunity]
              }}
              trigger={
                <Button variant="ghost" size="sm">
                  <Edit3 className="h-4 w-4" />
                </Button>
              }
            />
            
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/opportunities/${opportunity.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            
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

        {/* Saved Opportunity Details */}
        <div className="space-y-3 mb-4">
          {/* Notes Preview */}
          {savedOpportunity.notes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm bg-gray-50 p-2 rounded text-gray-700 line-clamp-2">
                {savedOpportunity.notes}
              </p>
            </div>
          )}

          {/* Tags */}
          {savedOpportunity.tags && savedOpportunity.tags.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {savedOpportunity.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Reminder Date */}
          {savedOpportunity.reminder_date && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Reminder</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm">
                  {format(new Date(savedOpportunity.reminder_date), 'PPP')}
                </span>
                {reminderDueSoon && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Due Soon
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Saved Date */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Saved</p>
            <p className="text-sm">
              {format(new Date(savedOpportunity.created_at), 'PPp')}
            </p>
          </div>
        </div>

        {/* Basic opportunity metadata */}
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

function SavedOpportunityCardSkeleton() {
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
        <div className="space-y-3">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="h-8 w-full bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}