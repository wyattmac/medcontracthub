'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  FileText, 
  Brain, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Copy,
  Download,
  Search
} from 'lucide-react'
import { toast } from 'sonner'

interface AttachedDocument {
  id: string
  name: string
  size: number
  type: string
  url?: string
  extractedText?: string
  isProcessing?: boolean
}

interface RequirementInsight {
  category: string
  text: string
  importance: 'high' | 'medium' | 'low'
  section?: string
}

interface DocumentAnalysis {
  documentId: string
  requirements: RequirementInsight[]
  summary: string
  keyPoints: string[]
  compliance: {
    certifications: string[]
    deadlines: string[]
    specifications: string[]
  }
}

interface ProposalDocumentAnalyzerProps {
  documents: AttachedDocument[]
  onAnalysisComplete?: (analysis: DocumentAnalysis[]) => void
}

export function ProposalDocumentAnalyzer({ 
  documents, 
  onAnalysisComplete 
}: ProposalDocumentAnalyzerProps) {
  const { toast } = useToast()
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, DocumentAnalysis>>({})
  const [isAnalyzing, setIsAnalyzing] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (documents.length > 0 && !selectedDocument) {
      setSelectedDocument(documents[0].id)
    }
  }, [documents, selectedDocument])

  const processDocumentWithAI = async (document: AttachedDocument) => {
    if (!document.extractedText) {
      toast({
        title: 'No Text Available',
        description: 'This document needs to be processed with OCR first.',
        variant: 'destructive'
      })
      return
    }

    setIsAnalyzing(prev => ({ ...prev, [document.id]: true }))

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: document.extractedText,
          analysisType: 'proposal_requirements',
          documentName: document.name
        })
      })

      if (!response.ok) {
        throw new Error('Failed to analyze document')
      }

      const result = await response.json()
      
      const analysis: DocumentAnalysis = {
        documentId: document.id,
        requirements: result.requirements || [],
        summary: result.summary || 'No summary available',
        keyPoints: result.keyPoints || [],
        compliance: result.compliance || {
          certifications: [],
          deadlines: [],
          specifications: []
        }
      }

      setAnalyses(prev => ({ ...prev, [document.id]: analysis }))
      
      if (onAnalysisComplete) {
        onAnalysisComplete(Object.values({ ...analyses, [document.id]: analysis }))
      }

      toast({
        title: 'Analysis Complete',
        description: `Found ${analysis.requirements.length} requirements in ${document.name}`
      })
    } catch (error) {
      console.error('AI analysis failed:', error)
      toast({
        title: 'Analysis Failed',
        description: 'Could not analyze document. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsAnalyzing(prev => ({ ...prev, [document.id]: false }))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied to clipboard' })
  }

  const exportAnalysis = (documentId: string) => {
    const analysis = analyses[documentId]
    const document = documents.find(d => d.id === documentId)
    
    if (!analysis || !document) return

    const exportData = {
      document: document.name,
      summary: analysis.summary,
      requirements: analysis.requirements,
      keyPoints: analysis.keyPoints,
      compliance: analysis.compliance,
      extractedText: document.extractedText
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${document.name}_analysis.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.extractedText && doc.extractedText.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const selectedDoc = documents.find(d => d.id === selectedDocument)
  const selectedAnalysis = selectedDocument ? analyses[selectedDocument] : null

  return (
    <div className="space-y-4">
      {/* Document Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Document Analysis & Requirements Extraction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {documents.map((doc) => (
              <Button
                key={doc.id}
                variant={selectedDocument === doc.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDocument(doc.id)}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {doc.name}
                {doc.isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                {doc.extractedText && <CheckCircle className="h-3 w-3 text-green-600" />}
              </Button>
            ))}
          </div>

          {selectedDoc && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => processDocumentWithAI(selectedDoc)}
                disabled={!selectedDoc.extractedText || isAnalyzing[selectedDoc.id]}
                size="sm"
                className="flex items-center gap-2"
              >
                {isAnalyzing[selectedDoc.id] ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Analyze Requirements
                  </>
                )}
              </Button>
              
              {selectedAnalysis && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportAnalysis(selectedDoc.id)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {selectedDoc && (
        <Tabs defaultValue="requirements" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="text">Raw Text</TabsTrigger>
          </TabsList>

          <TabsContent value="requirements" className="space-y-4">
            {selectedAnalysis ? (
              <div className="space-y-3">
                {selectedAnalysis.requirements.map((req, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge 
                          variant={req.importance === 'high' ? 'destructive' : 
                                 req.importance === 'medium' ? 'default' : 'secondary'}
                        >
                          {req.importance} priority
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(req.text)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm mb-2"><strong>{req.category}</strong></p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{req.text}</p>
                      {req.section && (
                        <p className="text-xs text-gray-500 mt-1">Section: {req.section}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {selectedAnalysis.requirements.length === 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No specific requirements were identified in this document.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Click "Analyze Requirements" to extract requirements from this document.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            {selectedAnalysis ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Document Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      {selectedAnalysis.summary}
                    </p>
                    
                    {selectedAnalysis.keyPoints.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Key Points:</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {selectedAnalysis.keyPoints.map((point, index) => (
                            <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Analyze the document first to see a summary.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            {selectedAnalysis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Certifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedAnalysis.compliance.certifications.length > 0 ? (
                        <ul className="space-y-1">
                          {selectedAnalysis.compliance.certifications.map((cert, index) => (
                            <li key={index} className="text-xs p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                              {cert}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500">No certifications identified</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Deadlines</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedAnalysis.compliance.deadlines.length > 0 ? (
                        <ul className="space-y-1">
                          {selectedAnalysis.compliance.deadlines.map((deadline, index) => (
                            <li key={index} className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded">
                              {deadline}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500">No deadlines identified</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Specifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedAnalysis.compliance.specifications.length > 0 ? (
                        <ul className="space-y-1">
                          {selectedAnalysis.compliance.specifications.map((spec, index) => (
                            <li key={index} className="text-xs p-2 bg-green-50 dark:bg-green-900/20 rounded">
                              {spec}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500">No specifications identified</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Analyze the document first to see compliance information.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            {selectedDoc?.extractedText ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Extracted Text
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(selectedDoc.extractedText || '')}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy All
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={selectedDoc.extractedText}
                    readOnly
                    className="min-h-96 font-mono text-xs"
                    placeholder="Extracted text will appear here..."
                  />
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {selectedDoc?.isProcessing 
                    ? 'OCR processing in progress...' 
                    : 'No text extracted yet. Upload and process the document first.'}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}