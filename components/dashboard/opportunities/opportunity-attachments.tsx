'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Download, ExternalLink, Loader2, AlertCircle, DownloadCloud } from 'lucide-react'
import { toast } from 'sonner'

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
      
      // Always use the no-auth endpoint - it uses the SAM.gov API key from the server
      const endpoint = `/api/sam-gov/attachments-no-auth?noticeId=${encodeURIComponent(noticeId)}`
      
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // If it's a 404, the opportunity might not exist in SAM.gov
        if (response.status === 404) {
          console.log('Opportunity not found in SAM.gov:', noticeId)
          setAttachments([])
          return
        }
        
        throw new Error(errorData.error || `Failed to fetch attachments: ${response.status}`)
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
      // Use the public download endpoint that adds the API key server-side
      const downloadUrl = `/api/sam-gov/attachments/download/public?url=${encodeURIComponent(attachment.url)}&filename=${encodeURIComponent(attachment.filename)}`
      
      // Create a hidden anchor element to trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = attachment.filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('Download Started', {
        description: `Downloading ${attachment.filename}`
      })
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Download Failed', {
        description: 'Failed to download attachment'
      })
    }
  }

  const handleDirectLink = (attachment: AttachmentInfo) => {
    // Open the SAM.gov link directly in a new tab
    window.open(attachment.url, '_blank', 'noopener,noreferrer')
  }

  const handleDownloadAll = async () => {
    if (attachments.length === 0) return
    
    toast.info('Download All Started', {
      description: `Downloading ${attachments.length} file${attachments.length !== 1 ? 's' : ''}...`
    })
    
    // Download each file with a small delay to avoid overwhelming the browser
    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i]
      
      // Add delay between downloads (except for the first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      try {
        const downloadUrl = `/api/sam-gov/attachments/download/public?url=${encodeURIComponent(attachment.url)}&filename=${encodeURIComponent(attachment.filename)}`
        
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = attachment.filename
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        console.log(`Downloading ${i + 1}/${attachments.length}: ${attachment.filename}`)
      } catch (error) {
        console.error(`Failed to download ${attachment.filename}:`, error)
        toast.error('Download Failed', {
          description: `Failed to download ${attachment.filename}`
        })
      }
    }
    
    toast.success('Download All Complete', {
      description: `Downloaded ${attachments.length} file${attachments.length !== 1 ? 's' : ''}`
    })
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
              No attachments found for this opportunity. This could mean:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>The opportunity has no attached documents</li>
                <li>The opportunity is not available in SAM.gov</li>
                <li>The notice ID ({noticeId}) may be invalid</li>
              </ul>
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
              <div className="flex items-center gap-2">
                {attachments.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadAll}
                    className="text-xs"
                  >
                    <DownloadCloud className="h-3 w-3 mr-1" />
                    Download All
                  </Button>
                )}
                <Badge variant="outline">
                  Notice ID: {noticeId}
                </Badge>
              </div>
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
                      <p className="text-xs text-gray-600 truncate" title={attachment.title || opportunityTitle}>
                        {attachment.title || opportunityTitle}
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