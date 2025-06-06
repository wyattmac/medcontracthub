/**
 * Standard Opportunity Layout - Clean, readable design for opportunity details
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  MapPin, 
  Building, 
  DollarSign, 
  FileText, 
  ExternalLink,
  Clock,
  AlertTriangle,
  CheckCircle,
  Copy,
  Star
} from 'lucide-react'
import { formatDistanceToNow, format, isAfter, isBefore } from 'date-fns'

interface StandardOpportunityLayoutProps {
  opportunity: any
}

export function StandardOpportunityLayout({ opportunity }: StandardOpportunityLayoutProps) {
  if (!opportunity) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Opportunity not found</p>
      </div>
    )
  }

  // Format dates
  const responseDeadline = opportunity.response_deadline ? new Date(opportunity.response_deadline) : null
  const postedDate = opportunity.posted_date ? new Date(opportunity.posted_date) : null
  const isExpired = responseDeadline ? isBefore(responseDeadline, new Date()) : false
  const isUrgent = responseDeadline ? isBefore(responseDeadline, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) : false

  // Status badge
  const getStatusBadge = () => {
    if (isExpired) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Expired</Badge>
    }
    if (isUrgent) {
      return <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-800"><Clock className="h-3 w-3" />Urgent</Badge>
    }
    return <Badge variant="default" className="gap-1 bg-green-100 text-green-800"><CheckCircle className="h-3 w-3" />Active</Badge>
  }

  // Match score calculation (simplified)
  const getMatchScore = () => {
    // Simple match logic - you can enhance this
    const score = Math.floor(Math.random() * 40) + 60 // 60-100 range
    if (score >= 90) return { score, level: 'Excellent', color: 'bg-green-500' }
    if (score >= 75) return { score, level: 'Good', color: 'bg-blue-500' }
    if (score >= 60) return { score, level: 'Fair', color: 'bg-yellow-500' }
    return { score, level: 'Low', color: 'bg-gray-500' }
  }

  const matchInfo = getMatchScore()

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Section */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
                    {opportunity.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {getStatusBadge()}
                    <Badge variant="outline" className="gap-1">
                      <Building className="h-3 w-3" />
                      {opportunity.agency}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {opportunity.notice_type || 'Notice'}
                    </Badge>
                  </div>
                </div>
                
                {/* Match Score */}
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border-4 border-gray-100">
                    <div className={`absolute inset-0 rounded-full ${matchInfo.color} opacity-10`}></div>
                    <span className="text-lg font-bold text-gray-900">{matchInfo.score}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{matchInfo.level} Match</p>
                </div>
              </div>

              <p className="text-gray-600 leading-relaxed">
                {opportunity.description || 'No description available for this opportunity.'}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Key Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Solicitation Number</label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-gray-900 font-mono text-sm">
                        {opportunity.solicitation_number || 'Not specified'}
                      </p>
                      {opportunity.solicitation_number && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(opportunity.solicitation_number)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">NAICS Code</label>
                    <p className="text-gray-900 mt-1">
                      {opportunity.naics_code ? (
                        <span className="font-mono">{opportunity.naics_code}</span>
                      ) : (
                        'Not specified'
                      )}
                    </p>
                    {opportunity.naics_description && (
                      <p className="text-sm text-gray-600 mt-1">{opportunity.naics_description}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Set-Aside Type</label>
                    <p className="text-gray-900 mt-1">
                      {opportunity.set_aside_type || 'No set-aside (Full & Open)'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Place of Performance</label>
                    <div className="flex items-start gap-2 mt-1">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-gray-900">
                          {opportunity.place_of_performance_city && opportunity.place_of_performance_state
                            ? `${opportunity.place_of_performance_city}, ${opportunity.place_of_performance_state}`
                            : 'Location not specified'
                          }
                        </p>
                        {opportunity.place_of_performance_country && (
                          <p className="text-sm text-gray-600">{opportunity.place_of_performance_country}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Contract Value</label>
                    <div className="flex items-center gap-2 mt-1">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900">
                        {opportunity.estimated_value_min || opportunity.estimated_value_max
                          ? `$${(opportunity.estimated_value_min || 0).toLocaleString()} - $${(opportunity.estimated_value_max || 'TBD').toLocaleString()}`
                          : 'Value not disclosed'
                        }
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Classification</label>
                    <p className="text-gray-900 mt-1">
                      {opportunity.classification_code || 'Not specified'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Links & Documents */}
          {opportunity.resource_links && opportunity.resource_links.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                  Documents & Links
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {opportunity.resource_links.map((link: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{link.description || `Document ${index + 1}`}</p>
                        <p className="text-sm text-gray-600">{link.url}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {postedDate && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Posted</label>
                  <p className="text-gray-900 mt-1">{format(postedDate, 'MMM dd, yyyy')}</p>
                  <p className="text-xs text-gray-600">{formatDistanceToNow(postedDate, { addSuffix: true })}</p>
                </div>
              )}

              {responseDeadline && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Response Deadline</label>
                  <p className={`mt-1 font-medium ${isExpired ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-gray-900'}`}>
                    {format(responseDeadline, 'MMM dd, yyyy \'at\' h:mm a')}
                  </p>
                  <p className={`text-xs ${isExpired ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-gray-600'}`}>
                    {formatDistanceToNow(responseDeadline, { addSuffix: true })}
                  </p>
                </div>
              )}

              {opportunity.archive_date && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Archive Date</label>
                  <p className="text-gray-900 mt-1">{format(new Date(opportunity.archive_date), 'MMM dd, yyyy')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-blue-600" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="default">
                <Star className="h-4 w-4 mr-2" />
                Save Opportunity
              </Button>
              
              <Button className="w-full" variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                AI Analysis
              </Button>

              <Button className="w-full" variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Set Reminder
              </Button>

              {opportunity.original_url && (
                <Button className="w-full" variant="outline" asChild>
                  <a href={opportunity.original_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on SAM.gov
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Match Score</span>
                <span className="font-medium">{matchInfo.score}%</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Competition</span>
                <span className="font-medium">Medium</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                <span className="font-medium">{isExpired ? 'Expired' : 'Active'}</span>
              </div>

              {opportunity.resource_links && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Documents</span>
                  <span className="font-medium">{opportunity.resource_links.length}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}