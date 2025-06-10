'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileSearch,
  ClipboardList,
  Download
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { RequirementExtractorModal } from './requirement-extractor-modal'
import { RequirementList } from './requirement-list'
import { ComplianceExportButton } from './compliance-export-button'
import { ComplianceMatrixWithDetails, RequirementSection } from '@/types/compliance.types'

interface ComplianceMatrixGeneratorProps {
  opportunityId: string
  opportunityTitle: string
  onComplete?: (matrixId: string) => void
}

export function ComplianceMatrixGenerator({ 
  opportunityId, 
  opportunityTitle,
  onComplete 
}: ComplianceMatrixGeneratorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionProgress, setExtractionProgress] = useState(0)
  const [matrix, setMatrix] = useState<ComplianceMatrixWithDetails | null>(null)
  const [showExtractorModal, setShowExtractorModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'requirements' | 'responses'>('requirements')

  const handleExtractRequirements = async (documentUrl: string, sections: RequirementSection[]) => {
    setIsExtracting(true)
    setExtractionProgress(0)

    try {
      // Start extraction progress simulation
      const progressInterval = setInterval(() => {
        setExtractionProgress(prev => Math.min(prev + 10, 90))
      }, 1000)

      const response = await fetch('/api/compliance/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          document_url: documentUrl,
          sections_to_extract: sections
        })
      })

      clearInterval(progressInterval)
      setExtractionProgress(100)

      if (!response.ok) {
        throw new Error('Failed to extract requirements')
      }

      const result = await response.json()
      
      // Fetch the created matrix with details
      const matrixResponse = await fetch(`/api/compliance/matrices/${result.data.matrix_id}`)
      if (!matrixResponse.ok) {
        throw new Error('Failed to fetch created matrix')
      }
      
      const matrixData = await matrixResponse.json()
      
      setMatrix(matrixData.data)
      setShowExtractorModal(false)
      
      toast({
        title: 'Requirements Extracted Successfully',
        description: `Found ${result.data.requirements.length} requirements across ${result.data.extraction_metadata.sections_found.join(', ')} sections.`
      })

      if (onComplete) {
        onComplete(result.data.matrix_id)
      }
    } catch (error) {
      toast({
        title: 'Extraction Failed',
        description: error instanceof Error ? error.message : 'Failed to extract requirements',
        variant: 'destructive'
      })
    } finally {
      setIsExtracting(false)
      setExtractionProgress(0)
    }
  }

  const handleCreateManualMatrix = async () => {
    try {
      const response = await fetch('/api/compliance/matrices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          title: `Compliance Matrix - ${opportunityTitle}`
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create compliance matrix')
      }

      const result = await response.json()
      setMatrix(result.data)
      
      toast({
        title: 'Matrix Created',
        description: 'You can now manually add requirements to track.'
      })
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create matrix',
        variant: 'destructive'
      })
    }
  }

  const getCompletionStats = () => {
    if (!matrix) return { completed: 0, total: 0, percentage: 0 }
    
    return {
      completed: matrix.completed_requirements || 0,
      total: matrix.total_requirements || 0,
      percentage: matrix.completion_percentage || 0
    }
  }

  const stats = getCompletionStats()

  if (isExtracting) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Extracting compliance requirements...</span>
            </div>
            <Progress value={extractionProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Analyzing document and identifying Section L/M requirements
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!matrix) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Create Compliance Matrix
            </CardTitle>
            <CardDescription>
              Generate a compliance matrix to track RFP requirements and ensure complete proposal coverage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <Button
                onClick={() => setShowExtractorModal(true)}
                className="h-auto flex-col items-start p-4 space-y-2"
                variant="outline"
              >
                <FileSearch className="h-6 w-6 text-primary" />
                <div className="space-y-1 text-left">
                  <div className="font-semibold">Extract from RFP</div>
                  <div className="text-sm text-muted-foreground">
                    Automatically extract Section L/M requirements using AI
                  </div>
                </div>
              </Button>

              <Button
                onClick={handleCreateManualMatrix}
                className="h-auto flex-col items-start p-4 space-y-2"
                variant="outline"
              >
                <FileText className="h-6 w-6 text-primary" />
                <div className="space-y-1 text-left">
                  <div className="font-semibold">Create Manually</div>
                  <div className="text-sm text-muted-foreground">
                    Start with an empty matrix and add requirements manually
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        <RequirementExtractorModal
          open={showExtractorModal}
          onClose={() => setShowExtractorModal(false)}
          onExtract={handleExtractRequirements}
          opportunityId={opportunityId}
        />
      </>
    )
  }

  return (
    <div className="space-y-6">
      {/* Matrix Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>{matrix.title}</CardTitle>
              <CardDescription>
                Tracking compliance for: {opportunityTitle}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={matrix.status === 'completed' ? 'default' : 'secondary'}>
                {matrix.status}
              </Badge>
              <ComplianceExportButton matrix={matrix} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Requirements</p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Progress value={stats.percentage} className="flex-1" />
                <span className="text-sm font-medium">{stats.percentage}%</span>
              </div>
              <p className="text-xs text-muted-foreground">Overall Progress</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requirements Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="responses">Response Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="requirements" className="mt-4">
          <RequirementList 
            matrixId={matrix.id} 
            requirements={matrix.requirements || []}
            viewMode="requirements"
            onUpdate={() => {
              // Refresh matrix data
              router.refresh()
            }}
          />
        </TabsContent>

        <TabsContent value="responses" className="mt-4">
          <RequirementList 
            matrixId={matrix.id} 
            requirements={matrix.requirements || []}
            viewMode="responses"
            onUpdate={() => {
              // Refresh matrix data
              router.refresh()
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Completion Alert */}
      {stats.percentage === 100 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>All Requirements Addressed!</AlertTitle>
          <AlertDescription>
            You have successfully tracked responses for all compliance requirements. 
            Export the matrix for inclusion in your proposal.
          </AlertDescription>
        </Alert>
      )}

      {stats.percentage > 0 && stats.percentage < 100 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Requirements Pending</AlertTitle>
          <AlertDescription>
            {stats.total - stats.completed} requirements still need responses. 
            Switch to the Response Tracking tab to update their status.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}