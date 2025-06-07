'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Download, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface OpportunityAttachmentsProps {
  noticeId: string
  opportunityTitle: string
}

interface AttachmentInfo {
  filename: string
  url: string
  title: string
}

export function OpportunityAttachments({ noticeId, opportunityTitle }: OpportunityAttachmentsProps) {
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (noticeId) {
      fetchAttachments()
    } else {
      setLoading(false)
    }
  }, [noticeId])

  const fetchAttachments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/sam-gov/attachments?noticeId=${encodeURIComponent(noticeId)}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch attachments: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setAttachments(data.data.attachments || [])
      } else {
        throw new Error(data.error || 'Failed to fetch attachments')
      }
    } catch (err) {
      console.error('Error fetching attachments:', err)
      setError(err instanceof Error ? err.message : 'Failed to load attachments')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (attachment: AttachmentInfo) => {
    try {
      // Create a server-side download endpoint that adds the API key
      const downloadUrl = `/api/sam-gov/attachments/download?url=${encodeURIComponent(attachment.url)}&filename=${encodeURIComponent(attachment.filename)}`
      
      // Open in new tab to trigger download
      window.open(downloadUrl, '_blank')
      
      toast({
        title: 'Download Started',
        description: `Downloading ${attachment.filename}`
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: 'Download Failed',
        description: 'Failed to download attachment',
        variant: 'destructive'
      })
    }
  }

  const handleDirectLink = (attachment: AttachmentInfo) => {
    // Open the SAM.gov link directly in a new tab
    window.open(attachment.url, '_blank', 'noopener,noreferrer')
  }

  if (!noticeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Documents
          </CardTitle>
          <CardDescription>
            Document attachments for this opportunity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No SAM.gov notice ID available for this opportunity.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Contract Documents
        </CardTitle>
        <CardDescription>
          Download contract documents and attachments from SAM.gov
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-600">Loading attachments...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {!loading && !error && attachments.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No attachments found for this opportunity.
            </AlertDescription>
          </Alert>
        )}

        {!loading && !error && attachments.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Available Documents</h4>
                <p className="text-sm text-gray-600">
                  {attachments.length} document{attachments.length !== 1 ? 's' : ''} available
                </p>
              </div>
              <Badge variant="outline">
                Notice ID: {noticeId}
              </Badge>
            </div>

            <div className="grid gap-3">
              {attachments.map((attachment, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate" title={attachment.filename}>
                        {attachment.filename}
                      </p>
                      <p className="text-xs text-gray-600 truncate" title={opportunityTitle}>
                        {opportunityTitle}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDirectLink(attachment)}
                      className="text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleDownload(attachment)}
                      className="text-xs bg-blue-600 hover:bg-blue-700"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500">
                💡 <strong>Tip:</strong> These documents contain the full contract requirements, 
                specifications, and submission guidelines. Download them to review before creating a proposal.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}