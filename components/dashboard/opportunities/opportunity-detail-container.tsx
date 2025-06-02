/**
 * Opportunity Detail Container - Comprehensive display of opportunity data
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SaveOpportunityButton } from './save-opportunity-button'
import { EditOpportunityNotesModal } from './edit-opportunity-notes-modal'
import { OpportunityAnalysisButton } from '../ai/opportunity-analysis-button'
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Building, 
  DollarSign, 
  FileText, 
  ExternalLink,
  Share,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus
} from 'lucide-react'
import { formatDistanceToNow, format, isAfter, isBefore } from 'date-fns'
import { calculateOpportunityMatch } from '@/lib/sam-gov/utils'

interface IOpportunityDetailContainerProps {
  opportunity: any // Full opportunity object from database
  companyNaicsCodes: string[]
  userId: string
}

export function OpportunityDetailContainer({ 
  opportunity, 
  companyNaicsCodes, 
  userId 
}: IOpportunityDetailContainerProps) {
  const router = useRouter()
  
  // Calculate match score
  const matchScore = calculateOpportunityMatch(opportunity, companyNaicsCodes)
  
  // Check if opportunity is saved
  const savedOpportunity = opportunity.saved_opportunities?.[0]
  const isSaved = !!savedOpportunity

  // Calculate deadline urgency
  const responseDeadline = new Date(opportunity.response_deadline)
  const now = new Date()
  const daysUntilDeadline = Math.ceil((responseDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  const getDeadlineStatus = () => {
    if (isBefore(responseDeadline, now)) {
      return { status: 'expired', color: 'destructive', icon: AlertTriangle }
    } else if (daysUntilDeadline <= 7) {
      return { status: 'urgent', color: 'destructive', icon: AlertTriangle }
    } else if (daysUntilDeadline <= 14) {
      return { status: 'warning', color: 'warning', icon: Clock }
    } else {
      return { status: 'normal', color: 'default', icon: CheckCircle }
    }
  }

  const deadlineStatus = getDeadlineStatus()



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount)
  }

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    if (score >= 40) return 'bg-orange-100 text-orange-800 border-orange-200'
    return 'bg-red-100 text-red-800 border-red-200'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Opportunities
        </Button>
        
        <div className="flex items-center gap-2">
          <SaveOpportunityButton 
            opportunityId={opportunity.id}
            isSaved={isSaved}
            variant="outline"
            size="default"
            showText={true}
          />
          
          <Button variant="outline" size="sm">
            <Share className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Title and Status */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">{opportunity.title}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building className="h-4 w-4" />
              <span>{opportunity.agency}</span>
              {opportunity.sub_agency && (
                <>
                  <span>•</span>
                  <span>{opportunity.sub_agency}</span>
                </>
              )}
              {opportunity.office && (
                <>
                  <span>•</span>
                  <span>{opportunity.office}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Badge variant={opportunity.status === 'active' ? 'default' : 'secondary'}>
              {opportunity.status.charAt(0).toUpperCase() + opportunity.status.slice(1)}
            </Badge>
            
            <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getMatchScoreColor(matchScore)}`}>
              {matchScore}% Match
            </div>
          </div>
        </div>

        {/* Deadline Alert */}
        <Alert variant={deadlineStatus.color === 'destructive' ? 'destructive' : 'default'}>
          <deadlineStatus.icon className="h-4 w-4" />
          <AlertDescription>
            <strong>Response Deadline:</strong> {format(responseDeadline, 'MMMM d, yyyy')} at {format(responseDeadline, 'h:mm a')}
            {daysUntilDeadline > 0 ? ` (${daysUntilDeadline} days remaining)` : ' (Expired)'}
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                {opportunity.description ? (
                  <p className="whitespace-pre-wrap">{opportunity.description}</p>
                ) : (
                  <p className="text-muted-foreground">No description available.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contract Details */}
          <Card>
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Solicitation Number</label>
                  <p className="font-mono text-sm">{opportunity.solicitation_number || 'Not specified'}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notice ID</label>
                  <p className="font-mono text-sm">{opportunity.notice_id}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contract Type</label>
                  <p>{opportunity.contract_type || 'Not specified'}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Set-Aside Type</label>
                  <p>{opportunity.set_aside_type || 'Not specified'}</p>
                </div>
              </div>

              {(opportunity.estimated_value_min || opportunity.estimated_value_max) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Estimated Value</label>
                  <div className="flex items-center gap-2 text-lg font-semibold text-green-600">
                    <DollarSign className="h-4 w-4" />
                    {opportunity.estimated_value_min && opportunity.estimated_value_max ? (
                      <span>
                        {formatCurrency(opportunity.estimated_value_min)} - {formatCurrency(opportunity.estimated_value_max)}
                      </span>
                    ) : opportunity.estimated_value_min ? (
                      <span>Min: {formatCurrency(opportunity.estimated_value_min)}</span>
                    ) : (
                      <span>Max: {formatCurrency(opportunity.estimated_value_max)}</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* NAICS Information */}
          {opportunity.naics_code && (
            <Card>
              <CardHeader>
                <CardTitle>Industry Classification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">NAICS Code</label>
                    <p className="font-mono text-lg">{opportunity.naics_code}</p>
                  </div>
                  {opportunity.naics_description && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <p>{opportunity.naics_description}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact Information */}
          {(opportunity.primary_contact_name || opportunity.primary_contact_email || opportunity.primary_contact_phone) && (
            <Card>
              <CardHeader>
                <CardTitle>Primary Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {opportunity.primary_contact_name && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p>{opportunity.primary_contact_name}</p>
                  </div>
                )}
                {opportunity.primary_contact_email && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p>
                      <a 
                        href={`mailto:${opportunity.primary_contact_email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {opportunity.primary_contact_email}
                      </a>
                    </p>
                  </div>
                )}
                {opportunity.primary_contact_phone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p>
                      <a 
                        href={`tel:${opportunity.primary_contact_phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {opportunity.primary_contact_phone}
                      </a>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          {opportunity.attachments && opportunity.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Attachments & Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {opportunity.attachments.map((attachment: any, index: number) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{attachment.name || attachment.filename}</span>
                        {attachment.type && (
                          <Badge variant="outline" className="text-xs">
                            {attachment.type}
                          </Badge>
                        )}
                      </div>
                      {attachment.url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Key Information */}
          <Card>
            <CardHeader>
              <CardTitle>Key Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Posted</p>
                  <p className="text-muted-foreground">
                    {format(new Date(opportunity.posted_date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Response Due</p>
                  <p className="text-muted-foreground">
                    {format(responseDeadline, 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              {opportunity.archive_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Archive Date</p>
                    <p className="text-muted-foreground">
                      {format(new Date(opportunity.archive_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}

              {(opportunity.place_of_performance_city || opportunity.place_of_performance_state) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Performance Location</p>
                    <p className="text-muted-foreground">
                      {[opportunity.place_of_performance_city, opportunity.place_of_performance_state]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Award Information */}
          {(opportunity.award_date || opportunity.award_amount || opportunity.awardee_name) && (
            <Card>
              <CardHeader>
                <CardTitle>Award Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {opportunity.award_date && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Award Date</label>
                    <p>{format(new Date(opportunity.award_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
                
                {opportunity.award_amount && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Award Amount</label>
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(opportunity.award_amount)}
                    </p>
                  </div>
                )}
                
                {opportunity.awardee_name && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Awardee</label>
                    <p>{opportunity.awardee_name}</p>
                  </div>
                )}
                
                {opportunity.awardee_duns && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Awardee DUNS</label>
                    <p className="font-mono text-sm">{opportunity.awardee_duns}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opportunity.sam_url && (
                <Button className="w-full" asChild>
                  <a href={opportunity.sam_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View on SAM.gov
                  </a>
                </Button>
              )}
              
              <Button className="w-full" asChild>
                <a href={`/dashboard/proposals/new?opportunity_id=${opportunity.id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Proposal
                </a>
              </Button>
              
              <OpportunityAnalysisButton 
                opportunityId={opportunity.id}
                opportunityTitle={opportunity.title}
                trigger={
                  <Button variant="outline" className="w-full">
                    Generate Analysis
                  </Button>
                }
              />
              
              <Button variant="outline" className="w-full">
                Set Reminder
              </Button>
            </CardContent>
          </Card>

          {/* User Notes */}
          {savedOpportunity && (
            <Card>
              <CardHeader>
                <CardTitle>My Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {savedOpportunity.notes && (
                  <div>
                    <p className="text-sm whitespace-pre-wrap">{savedOpportunity.notes}</p>
                  </div>
                )}
                
                {savedOpportunity.tags && savedOpportunity.tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tags</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {savedOpportunity.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={savedOpportunity.is_pursuing}
                    readOnly
                    className="h-4 w-4"
                  />
                  <label className="text-sm">Actively pursuing</label>
                </div>

                {savedOpportunity.reminder_date && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Reminder</label>
                    <p className="text-sm">
                      {format(new Date(savedOpportunity.reminder_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
                
                <EditOpportunityNotesModal 
                  opportunityId={opportunity.id}
                  opportunity={opportunity}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}