'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FileText, Loader2, CheckCircle, AlertCircle, Edit3, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Database } from '@/types/database.types'

type Opportunity = Database['public']['Tables']['opportunities']['Row']

interface MarkForProposalButtonProps {
  opportunity: Opportunity
}

interface SAMAttachmentResult {
  success: boolean
  data: {
    noticeId: string
    attachments: Array<{
      filename: string
      extractedText: string
      processingSuccess: boolean
      fileSize: number
      error?: string
    }>
    requirements: {
      contractNumber?: string
      deadline?: string
      contactEmail?: string
      totalValue?: string
      submissionRequirements: string[]
      technicalRequirements: string[]
      complianceRequirements: string[]
    }
    summary: string
    processedAt: string
  }
  error?: string
}

export function MarkForProposalButton({ opportunity }: MarkForProposalButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [processingResult, setProcessingResult] = useState<SAMAttachmentResult | null>(null)
  const router = useRouter()

  const processSAMAttachmentsMutation = useMutation({
    mutationFn: async () => {
      // Use notice_id from opportunity for SAM.gov API
      const noticeId = opportunity.notice_id || opportunity.id
      
      const response = await fetch('/api/sam-gov/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noticeId,
          maxAttachments: 5,
          includeRequirements: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to process SAM.gov attachments')
      }

      return response.json() as Promise<SAMAttachmentResult>
    },
    onSuccess: (data) => {
      setProcessingResult(data)
      
      if (data.success) {
        const successfulAttachments = data.data.attachments.filter(a => a.processingSuccess).length
        const totalRequirements = 
          data.data.requirements.submissionRequirements.length +
          data.data.requirements.technicalRequirements.length +
          data.data.requirements.complianceRequirements.length

        toast.success('SAM.gov Documents Processed', {
          description: `Successfully processed ${successfulAttachments} attachments with ${totalRequirements} requirements extracted.`
        })
      } else {
        toast.info('Processing Complete', {
          description: data.error || 'Processing completed with some issues'
        })
      }
    },
    onError: (error) => {
      console.error('SAM.gov attachment processing failed:', error)
      toast.error('Processing Failed', {
        description: error.message || 'Failed to process SAM.gov attachments'
      })
    }
  })

  const handleMarkForProposal = () => {
    // Always show dialog for SAM.gov attachment processing
    // The system will check for attachments via the API
    setShowDialog(true)
  }

  const navigateToProposal = () => {
    // Pass processing results to proposal form if available
    const baseUrl = `/dashboard/proposals/new?opportunityId=${opportunity.id}`
    
    if (processingResult?.success) {
      // Store processing results in sessionStorage for proposal form
      sessionStorage.setItem(
        `sam_processing_${opportunity.id}`, 
        JSON.stringify(processingResult.data)
      )
    }
    
    router.push(baseUrl)
  }

  const handleCreateProposal = () => {
    setShowDialog(false)
    navigateToProposal()
  }

  // Get attachment count from processing result or estimate from notice_id
  const getAttachmentStatus = () => {
    if (processingResult?.success) {
      return {
        count: processingResult.data.attachments.length,
        processed: processingResult.data.attachments.filter(a => a.processingSuccess).length
      }
    }
    
    // For SAM.gov opportunities, we'll check dynamically
    return {
      count: opportunity.notice_id ? '?' : 0,
      processed: 0
    }
  }

  const attachmentStatus = getAttachmentStatus()

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={handleMarkForProposal}
        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
        title="Start proposal with OCR analysis"
      >
        <Edit3 className="h-4 w-4 mr-1" />
        Mark for Proposal
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              Process Documents for Proposal
            </DialogTitle>
            <DialogDescription>
              Extract requirements and specifications from contract documents using AI-powered OCR
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Opportunity Info */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border">
              <h4 className="font-medium mb-2 line-clamp-2">{opportunity.title}</h4>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {attachmentStatus.count} SAM.gov attachment{attachmentStatus.count !== 1 ? 's' : ''} 
                  {attachmentStatus.processed > 0 && ` (${attachmentStatus.processed} processed)`}
                </span>
                <Badge variant="outline" className="text-xs">
                  {opportunity.agency}
                </Badge>
                {opportunity.naics_code && (
                  <Badge variant="outline" className="text-xs">
                    NAICS {opportunity.naics_code}
                  </Badge>
                )}
                {opportunity.notice_id && (
                  <Badge variant="outline" className="text-xs">
                    {opportunity.notice_id}
                  </Badge>
                )}
              </div>
            </div>

            {/* Processing Status */}
            {processSAMAttachmentsMutation.isPending && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  Downloading and processing SAM.gov attachments with AI-powered OCR... This may take a few minutes.
                </AlertDescription>
              </Alert>
            )}

            {/* Processing Results */}
            {processingResult && (
              <div className="space-y-4">
                <Alert className={processingResult.success ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20'}>
                  {processingResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <AlertDescription className={processingResult.success ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'}>
                    {processingResult.success ? processingResult.data.summary : (processingResult.error || 'Processing completed with issues')}
                  </AlertDescription>
                </Alert>

                {/* Statistics */}
                {processingResult.success && processingResult.data.attachments.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200">
                      <div className="text-sm text-blue-600 dark:text-blue-400">SAM.gov Attachments</div>
                      <div className="text-2xl font-semibold text-blue-800 dark:text-blue-200">
                        {processingResult.data.attachments.filter(a => a.processingSuccess).length} / {processingResult.data.attachments.length}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        Successfully processed
                      </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200">
                      <div className="text-sm text-green-600 dark:text-green-400">Total Requirements</div>
                      <div className="text-2xl font-semibold text-green-800 dark:text-green-200">
                        {processingResult.data.requirements.submissionRequirements.length + 
                         processingResult.data.requirements.technicalRequirements.length + 
                         processingResult.data.requirements.complianceRequirements.length}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">
                        Ready for proposal
                      </div>
                    </div>
                  </div>
                )}

                {/* Requirements Summary */}
                {processingResult.success && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200">
                      <div className="font-medium text-purple-800 dark:text-purple-200 mb-2">
                        Submission ({processingResult.data.requirements.submissionRequirements.length})
                      </div>
                      <ul className="text-purple-700 dark:text-purple-300 space-y-1">
                        {processingResult.data.requirements.submissionRequirements.slice(0, 3).map((req, i) => (
                          <li key={i} className="text-xs truncate">• {req}</li>
                        ))}
                        {processingResult.data.requirements.submissionRequirements.length > 3 && (
                          <li className="text-xs text-purple-600">+ {processingResult.data.requirements.submissionRequirements.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200">
                      <div className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Technical ({processingResult.data.requirements.technicalRequirements.length})
                      </div>
                      <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                        {processingResult.data.requirements.technicalRequirements.slice(0, 3).map((req, i) => (
                          <li key={i} className="text-xs truncate">• {req}</li>
                        ))}
                        {processingResult.data.requirements.technicalRequirements.length > 3 && (
                          <li className="text-xs text-blue-600">+ {processingResult.data.requirements.technicalRequirements.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200">
                      <div className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                        Compliance ({processingResult.data.requirements.complianceRequirements.length})
                      </div>
                      <ul className="text-orange-700 dark:text-orange-300 space-y-1">
                        {processingResult.data.requirements.complianceRequirements.slice(0, 3).map((req, i) => (
                          <li key={i} className="text-xs truncate">• {req}</li>
                        ))}
                        {processingResult.data.requirements.complianceRequirements.length > 3 && (
                          <li className="text-xs text-orange-600">+ {processingResult.data.requirements.complianceRequirements.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Document Details */}
                {processingResult.success && processingResult.data.attachments.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-xs font-medium text-gray-600 dark:text-gray-400">Attachment</th>
                          <th className="text-center p-2 text-xs font-medium text-gray-600 dark:text-gray-400">Status</th>
                          <th className="text-center p-2 text-xs font-medium text-gray-600 dark:text-gray-400">Size</th>
                          <th className="text-center p-2 text-xs font-medium text-gray-600 dark:text-gray-400">Text Length</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {processingResult.data.attachments.map((attachment, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="p-2 font-mono text-xs truncate max-w-32" title={attachment.filename}>
                              {attachment.filename}
                            </td>
                            <td className="p-2 text-center">
                              {attachment.processingSuccess ? (
                                <Badge variant="default" className="text-xs bg-green-100 text-green-800">Success</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">Failed</Badge>
                              )}
                            </td>
                            <td className="p-2 text-center text-xs">
                              {(attachment.fileSize / 1024).toFixed(1)}KB
                            </td>
                            <td className="p-2 text-center text-xs">
                              {attachment.extractedText.length.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!processingResult && !processSAMAttachmentsMutation.isPending && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  {opportunity.notice_id 
                    ? "Process SAM.gov attachments to extract requirements automatically, or create proposal manually."
                    : "No SAM.gov notice ID found. You can create a proposal manually."
                  }
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={processSAMAttachmentsMutation.isPending}
            >
              Cancel
            </Button>
            
            {opportunity.notice_id && !processingResult && (
              <Button
                onClick={() => processSAMAttachmentsMutation.mutate()}
                disabled={processSAMAttachmentsMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {processSAMAttachmentsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing SAM.gov...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Process SAM.gov Attachments
                  </>
                )}
              </Button>
            )}
            
            <Button
              onClick={handleCreateProposal}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              disabled={processSAMAttachmentsMutation.isPending}
            >
              <Edit3 className="mr-2 h-4 w-4" />
              Create Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}