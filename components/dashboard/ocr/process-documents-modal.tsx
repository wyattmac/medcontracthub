'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FileText, Loader2, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react'
import { apiLogger } from '@/lib/errors/logger'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'

interface IProcessDocumentsModalProps {
  open: boolean
  onClose: () => void
  opportunityId: string
  opportunityTitle: string
  documentCount: number
  onProcessComplete?: () => void
}

interface IProcessingResult {
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
  statistics?: {
    monthlyProcessed: number
    monthlyCached: number
    monthlyCost: number
    cacheHitRate: number
  }
}

export function ProcessDocumentsModal({
  open,
  onClose,
  opportunityId,
  opportunityTitle,
  documentCount,
  onProcessComplete
}: IProcessDocumentsModalProps) {
  const { toast } = useToast()
  const [processingResult, setProcessingResult] = useState<IProcessingResult | null>(null)

  const processDocumentsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ocr/process-optimized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId,
          priority: 5,
          skipCache: false,
          maxRetries: 3
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to process documents')
      }

      return response.json() as Promise<IProcessingResult>
    },
    onSuccess: (data) => {
      setProcessingResult(data)
      
      if (data.success) {
        toast({
          title: 'Documents Processed',
          description: `Successfully processed ${data.documentsProcessed} documents with ${data.totalRequirements} requirements extracted.`
        })
        
        if (onProcessComplete) {
          onProcessComplete()
        }
      } else {
        toast({
          title: 'Processing Complete',
          description: data.message,
          variant: 'default'
        })
      }
    },
    onError: (error) => {
      apiLogger.error('Document processing failed', error as Error)
      toast({
        title: 'Processing Failed',
        description: error.message || 'Failed to process documents',
        variant: 'destructive'
      })
    }
  })

  const handleClose = () => {
    setProcessingResult(null)
    onClose()
  }

  const estimatedCost = documentCount * 0.001 // $0.001 per page with Mistral OCR

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Process Contract Documents</DialogTitle>
          <DialogDescription>
            Extract product requirements from contract documents using AI-powered OCR
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Opportunity Info */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-medium mb-2">{opportunityTitle}</h4>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {documentCount} document{documentCount !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                Est. cost: {formatCurrency(estimatedCost)}
              </span>
            </div>
          </div>

          {/* Processing Status */}
          {processDocumentsMutation.isPending && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Processing documents... This may take a few minutes.
              </AlertDescription>
            </Alert>
          )}

          {/* Processing Results */}
          {processingResult && (
            <div className="space-y-4">
              {/* Summary */}
              <Alert className={processingResult.success ? 'border-green-200' : 'border-yellow-200'}>
                {processingResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <AlertDescription>{processingResult.message}</AlertDescription>
              </Alert>

              {/* Statistics */}
              {processingResult.documentsProcessed > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <div className="text-sm text-blue-600 dark:text-blue-400">Documents Processed</div>
                    <div className="text-2xl font-semibold">{processingResult.documentsProcessed}</div>
                    {processingResult.documentsCached > 0 && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {processingResult.documentsCached} from cache
                      </div>
                    )}
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <div className="text-sm text-green-600 dark:text-green-400">Requirements Found</div>
                    <div className="text-2xl font-semibold">{processingResult.totalRequirements}</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                    <div className="text-sm text-purple-600 dark:text-purple-400">Total Cost</div>
                    <div className="text-2xl font-semibold">{formatCurrency(processingResult.totalCost)}</div>
                    {processingResult.savedCost > 0 && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Saved {formatCurrency(processingResult.savedCost)} from cache
                      </div>
                    )}
                  </div>
                  {processingResult.statistics && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Cache Hit Rate</div>
                      <div className="text-2xl font-semibold">
                        {processingResult.statistics.cacheHitRate.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Document Details */}
              {processingResult.results && processingResult.results.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Document</th>
                        <th className="text-center p-2">Status</th>
                        <th className="text-center p-2">Requirements</th>
                        <th className="text-right p-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {processingResult.results.map((doc) => (
                        <tr key={doc.documentId}>
                          <td className="p-2 font-mono text-xs">{doc.fileName}</td>
                          <td className="p-2 text-center">
                            {doc.cached ? (
                              <Badge variant="secondary" className="text-xs">Cached</Badge>
                            ) : (
                              <Badge variant="default" className="text-xs">Processed</Badge>
                            )}
                          </td>
                          <td className="p-2 text-center">{doc.requirementsFound}</td>
                          <td className="p-2 text-right">{formatCurrency(doc.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={processDocumentsMutation.isPending}
          >
            {processingResult ? 'Close' : 'Cancel'}
          </Button>
          {!processingResult && (
            <Button
              onClick={() => processDocumentsMutation.mutate()}
              disabled={processDocumentsMutation.isPending}
            >
              {processDocumentsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Process Documents
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}