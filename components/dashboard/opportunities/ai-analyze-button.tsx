'use client'

import { useState } from 'react'
import { Brain, Loader2, FileText, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/sam-gov/utils'

interface AIAnalyzeButtonProps {
  opportunityId: string
  noticeId: string
  opportunityTitle: string
  className?: string
  size?: 'sm' | 'default' | 'lg'
}

interface AttachmentAnalysis {
  fileName: string
  pageCount: number
  hasStructuredData: boolean
  isMedicalRelated: boolean
  relevanceScore: number
  error?: string
  extractedData?: {
    contractNumber?: string
    deadline?: string
    contactEmail?: string
    contactPhone?: string
    totalValue?: string
    deliveryDate?: string
    technicalRequirements?: string[]
    certificationRequirements?: string[]
  }
  medicalRelevance?: {
    isMedicalRelated: boolean
    relevanceScore: number
    medicalKeywords: string[]
    recommendation: string
  }
  extractedText?: string
}

export function AIAnalyzeButton({
  opportunityId,
  noticeId,
  opportunityTitle,
  className,
  size = 'sm'
}: AIAnalyzeButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<{
    processed: number
    failed: number
    results: AttachmentAnalysis[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)
    setAnalysisResults(null)
    setIsOpen(true)

    try {
      const response = await fetch('/api/sam-gov/attachments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          noticeIds: [noticeId],
          analyzeRelevance: true,
          extractStructuredData: true
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze attachments')
      }

      const data = await response.json()
      
      if (data.processed === 0) {
        setError('No attachments found for this opportunity')
      } else {
        setAnalysisResults(data)
        
        // Show success toast
        toast.success('Analysis Complete', {
          description: `Successfully analyzed ${data.processed} attachment${data.processed > 1 ? 's' : ''}`
        })
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze opportunity')
      
      toast.error('Analysis Failed', {
        description: 'Unable to analyze opportunity attachments'
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleViewFullText = async (noticeId: string) => {
    try {
      const response = await fetch(`/api/sam-gov/attachments/process?noticeId=${noticeId}`)
      const data = await response.json()
      
      if (data.documents && data.documents.length > 0) {
        // Open in new window with extracted text
        const fullTextWindow = window.open('', '_blank')
        if (fullTextWindow) {
          fullTextWindow.document.write(`
            <html>
              <head>
                <title>Extracted Text - ${opportunityTitle}</title>
                <style>
                  body { font-family: monospace; padding: 20px; white-space: pre-wrap; }
                </style>
              </head>
              <body>
                <h1>${opportunityTitle}</h1>
                <hr>
                <pre>${data.documents[0].extracted_text || 'No text extracted'}</pre>
              </body>
            </html>
          `)
          fullTextWindow.document.close()
        }
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Unable to load full text',
        variant: 'destructive'
      })
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        className={className}
        title="Analyze opportunity attachments with AI"
      >
        {isAnalyzing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Brain className="h-4 w-4" />
        )}
        {size !== 'sm' && <span className="ml-2">AI Analyze</span>}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Analysis Results
            </DialogTitle>
            <DialogDescription>
              {opportunityTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {isAnalyzing && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Analyzing attachments...</p>
                <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
              </div>
            )}

            {error && !isAnalyzing && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {analysisResults && !isAnalyzing && (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Attachments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{analysisResults.processed}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Medical Relevance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {analysisResults.results.filter(r => r.isMedicalRelated).length}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Avg. Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {Math.round(
                          analysisResults.results.reduce((sum, r) => sum + (r.relevanceScore || 0), 0) / 
                          analysisResults.results.length
                        )}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Results */}
                {analysisResults.results.map((result, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {result.fileName}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {result.isMedicalRelated && (
                            <Badge variant="default">Medical</Badge>
                          )}
                          <Badge variant="outline">
                            {result.pageCount} page{result.pageCount > 1 ? 's' : ''}
                          </Badge>
                          {result.relevanceScore > 0 && (
                            <Badge 
                              variant={result.relevanceScore >= 80 ? 'default' : 
                                      result.relevanceScore >= 50 ? 'secondary' : 'outline'}
                            >
                              {result.relevanceScore}% relevant
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {result.error ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{result.error}</AlertDescription>
                        </Alert>
                      ) : (
                        <Tabs defaultValue="extracted" className="w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
                            <TabsTrigger value="medical">Medical Analysis</TabsTrigger>
                            <TabsTrigger value="preview">Text Preview</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="extracted" className="space-y-3">
                            {result.extractedData ? (
                              <div className="grid grid-cols-2 gap-4">
                                {result.extractedData.contractNumber && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Contract Number</p>
                                    <p className="font-medium">{result.extractedData.contractNumber}</p>
                                  </div>
                                )}
                                {result.extractedData.deadline && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Deadline</p>
                                    <p className="font-medium">{result.extractedData.deadline}</p>
                                  </div>
                                )}
                                {result.extractedData.totalValue && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Total Value</p>
                                    <p className="font-medium">{result.extractedData.totalValue}</p>
                                  </div>
                                )}
                                {result.extractedData.contactEmail && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Contact Email</p>
                                    <p className="font-medium">{result.extractedData.contactEmail}</p>
                                  </div>
                                )}
                                {result.extractedData.contactPhone && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Contact Phone</p>
                                    <p className="font-medium">{result.extractedData.contactPhone}</p>
                                  </div>
                                )}
                                {result.extractedData.deliveryDate && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Delivery Date</p>
                                    <p className="font-medium">{result.extractedData.deliveryDate}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-muted-foreground">No structured data extracted</p>
                            )}
                            
                            {result.extractedData?.technicalRequirements && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Technical Requirements</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {result.extractedData.technicalRequirements.map((req, i) => (
                                    <li key={i} className="text-sm">{req}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {result.extractedData?.certificationRequirements && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Certification Requirements</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {result.extractedData.certificationRequirements.map((cert, i) => (
                                    <li key={i} className="text-sm">{cert}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="medical" className="space-y-3">
                            {result.medicalRelevance ? (
                              <>
                                <div>
                                  <p className="text-sm text-muted-foreground">Medical Relevance</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant={result.medicalRelevance.isMedicalRelated ? 'default' : 'secondary'}>
                                      {result.medicalRelevance.isMedicalRelated ? 'Medical Related' : 'Not Medical'}
                                    </Badge>
                                    <span className="text-sm font-medium">
                                      {result.medicalRelevance.relevanceScore}% relevant
                                    </span>
                                  </div>
                                </div>
                                
                                {result.medicalRelevance.medicalKeywords.length > 0 && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Medical Keywords Found</p>
                                    <div className="flex flex-wrap gap-1">
                                      {result.medicalRelevance.medicalKeywords.map((keyword, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">
                                          {keyword}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                <div>
                                  <p className="text-sm text-muted-foreground">Recommendation</p>
                                  <p className="text-sm mt-1">{result.medicalRelevance.recommendation}</p>
                                </div>
                              </>
                            ) : (
                              <p className="text-muted-foreground">No medical analysis available</p>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="preview">
                            {result.extractedText ? (
                              <div>
                                <div className="bg-muted p-4 rounded-md max-h-64 overflow-y-auto">
                                  <pre className="text-xs whitespace-pre-wrap font-mono">
                                    {result.extractedText.substring(0, 1000)}...
                                  </pre>
                                </div>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => handleViewFullText(noticeId)}
                                >
                                  View Full Text
                                </Button>
                              </div>
                            ) : (
                              <p className="text-muted-foreground">No text preview available</p>
                            )}
                          </TabsContent>
                        </Tabs>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}