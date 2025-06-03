'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Loader2, CheckCircle2, AlertCircle, FileSearch } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api/client'

interface IProcessDocumentsButtonProps {
  opportunityId: string
  documentCount: number
  onProcessComplete?: () => void
}

export function ProcessDocumentsButton({ 
  opportunityId, 
  documentCount,
  onProcessComplete 
}: IProcessDocumentsButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [results, setResults] = useState<any>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const processDocuments = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/ocr/process', {
        opportunityId,
        processAllDocuments: true
      })
      return response.data
    },
    onSuccess: (data) => {
      setResults(data)
      toast({
        title: 'Documents processed successfully',
        description: `Extracted ${data.totalRequirements} product requirements from ${data.documentsProcessed} documents`,
      })
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] })
      queryClient.invalidateQueries({ queryKey: ['requirements', opportunityId] })
      
      if (onProcessComplete) {
        onProcessComplete()
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Processing failed',
        description: error.response?.data?.message || 'Failed to process documents',
        variant: 'destructive',
      })
    }
  })

  if (documentCount === 0) {
    return null
  }

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <FileSearch className="h-4 w-4" />
        Extract Requirements ({documentCount} docs)
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Extract Product Requirements</DialogTitle>
            <DialogDescription>
              Use AI to analyze contract documents and extract product specifications
            </DialogDescription>
          </DialogHeader>

          {!processDocuments.isPending && !results && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Documents Available</CardTitle>
                  <CardDescription>
                    This opportunity has {documentCount} attached document{documentCount !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Our AI will analyze these documents to extract:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Product names and descriptions
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Technical specifications
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Quantities and units
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Required certifications (FDA, ISO, etc.)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Delivery requirements
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => processDocuments.mutate()}
                  disabled={processDocuments.isPending}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Start Extraction
                </Button>
              </div>
            </div>
          )}

          {processDocuments.isPending && (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-lg font-medium">Processing documents...</p>
              <p className="text-sm text-muted-foreground mt-2">
                This may take a few minutes depending on document size
              </p>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-green-900">Processing Complete</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Successfully extracted {results.totalRequirements} product requirements
                      from {results.documentsProcessed} documents
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Processing Summary</h4>
                {results.results.map((doc: any, index: number) => (
                  <Card key={doc.documentId} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{doc.fileName}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {doc.requirementsFound} requirements • {doc.processingTimeMs}ms
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false)
                    setResults(null)
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    // Navigate to requirements view
                    window.location.href = `/dashboard/opportunities/${opportunityId}/requirements`
                  }}
                >
                  View Requirements
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}