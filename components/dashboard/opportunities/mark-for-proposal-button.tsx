'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FileText, Loader2, CheckCircle, AlertCircle, Edit3, Zap } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Database } from '@/types/database.types'

type Opportunity = Database['public']['Tables']['opportunities']['Row']

interface MarkForProposalButtonProps {
  opportunity: Opportunity
}

interface OCRProcessingResult {
  success: boolean
  message: string
  documentsProcessed: number
  documentsCached: number
  totalRequirements: number
  totalCost: number
  savedCost: number
  results: Array<{
    documentId: string
    fileName: string
    cached: boolean
    requirementsFound: number
    processingTimeMs: number
    cost: number
  }>
}

export function MarkForProposalButton({ opportunity }: MarkForProposalButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [processingResult, setProcessingResult] = useState<OCRProcessingResult | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const processDocumentsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ocr/process-optimized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          priority: 5,
          skipCache: false,
          maxRetries: 3
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to process documents')
      }

      return response.json() as Promise<OCRProcessingResult>
    },
    onSuccess: (data) => {
      setProcessingResult(data)
      
      if (data.success) {
        toast({
          title: 'Documents Processed',
          description: `Successfully processed ${data.documentsProcessed} documents with ${data.totalRequirements} requirements extracted.`
        })
      } else {
        toast({
          title: 'Processing Complete',
          description: data.message,
          variant: 'default'
        })
      }
    },
    onError: (error) => {
      console.error('Document processing failed:', error)
      toast({
        title: 'Processing Failed',
        description: error.message || 'Failed to process documents',
        variant: 'destructive'
      })
    }
  })

  const handleMarkForProposal = () => {
    // Check if opportunity has documents to process
    const hasDocuments = opportunity.additional_info && 
      (opportunity.additional_info as any)?.resourceLinks?.length > 0

    if (hasDocuments) {
      setShowDialog(true)
    } else {
      // No documents to process, go directly to proposal creation
      navigateToProposal()
    }
  }

  const navigateToProposal = () => {
    router.push(`/dashboard/proposals/new?opportunityId=${opportunity.id}`)
  }

  const handleCreateProposal = () => {
    setShowDialog(false)
    navigateToProposal()
  }

  const documentCount = opportunity.additional_info ? 
    ((opportunity.additional_info as any)?.resourceLinks?.length || 0) : 0

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
                  {documentCount} document{documentCount !== 1 ? 's' : ''} available
                </span>
                <Badge variant="outline" className="text-xs">
                  {opportunity.agency}
                </Badge>
                {opportunity.naics_code && (
                  <Badge variant="outline" className="text-xs">
                    NAICS {opportunity.naics_code}
                  </Badge>
                )}
              </div>
            </div>

            {/* Processing Status */}
            {processDocumentsMutation.isPending && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  Processing documents with AI-powered OCR... This may take a few minutes.
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
                    {processingResult.message}
                  </AlertDescription>
                </Alert>

                {/* Statistics */}
                {processingResult.documentsProcessed > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200">
                      <div className="text-sm text-blue-600 dark:text-blue-400">Documents Processed</div>
                      <div className="text-2xl font-semibold text-blue-800 dark:text-blue-200">
                        {processingResult.documentsProcessed}
                      </div>
                      {processingResult.documentsCached > 0 && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          {processingResult.documentsCached} from cache
                        </div>
                      )}
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200">
                      <div className="text-sm text-green-600 dark:text-green-400">Requirements Found</div>
                      <div className="text-2xl font-semibold text-green-800 dark:text-green-200">
                        {processingResult.totalRequirements}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">
                        Ready for proposal
                      </div>
                    </div>
                  </div>
                )}

                {/* Document Details */}
                {processingResult.results && processingResult.results.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-xs font-medium text-gray-600 dark:text-gray-400">Document</th>
                          <th className="text-center p-2 text-xs font-medium text-gray-600 dark:text-gray-400">Status</th>
                          <th className="text-center p-2 text-xs font-medium text-gray-600 dark:text-gray-400">Requirements</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {processingResult.results.map((doc) => (
                          <tr key={doc.documentId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="p-2 font-mono text-xs truncate max-w-48" title={doc.fileName}>
                              {doc.fileName}
                            </td>
                            <td className="p-2 text-center">
                              {doc.cached ? (
                                <Badge variant="secondary" className="text-xs">Cached</Badge>
                              ) : (
                                <Badge variant="default" className="text-xs">Processed</Badge>
                              )}
                            </td>
                            <td className="p-2 text-center font-medium">{doc.requirementsFound}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {documentCount === 0 && (
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  No documents found for this opportunity. You can still create a proposal manually.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={processDocumentsMutation.isPending}
            >
              Cancel
            </Button>
            
            {documentCount > 0 && !processingResult && (
              <Button
                onClick={() => processDocumentsMutation.mutate()}
                disabled={processDocumentsMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {processDocumentsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Process with OCR
                  </>
                )}
              </Button>
            )}
            
            <Button
              onClick={handleCreateProposal}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              disabled={processDocumentsMutation.isPending}
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