'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Sparkles, 
  FileText, 
  Target, 
  Shield, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Download,
  Save,
  RefreshCw,
  Brain,
  Lightbulb,
  BarChart
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface AIProposalGeneratorProps {
  opportunityId: string
  proposalId?: string
  rfpDocumentUrl?: string
  rfpDocumentName?: string
  onSectionGenerated?: (section: string, content: string) => void
}

interface GenerationResult {
  section: string
  content: string
  word_count: number
  win_themes?: string[]
  discriminators?: string[]
  compliance_score?: number
  evaluation_alignment?: Array<{
    factor: string
    addressed: boolean
    strength: 'strong' | 'adequate' | 'weak'
  }>
  graphics_recommendations?: Array<{
    concept: string
    purpose: string
    placement: string
  }>
  risks_identified?: Array<{
    description: string
    severity: string
    mitigation: string
  }>
  next_steps?: string[]
}

const SECTIONS = [
  { value: 'executive_summary', label: 'Executive Summary', icon: FileText },
  { value: 'technical_approach', label: 'Technical Approach', icon: Brain },
  { value: 'management_approach', label: 'Management Approach', icon: Shield },
  { value: 'past_performance', label: 'Past Performance', icon: TrendingUp },
  { value: 'pricing', label: 'Pricing Strategy', icon: BarChart },
  { value: 'full_proposal', label: 'Full Proposal', icon: Sparkles }
]

export function AIProposalGenerator({
  opportunityId,
  proposalId,
  rfpDocumentUrl,
  rfpDocumentName,
  onSectionGenerated
}: AIProposalGeneratorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedSection, setSelectedSection] = useState('executive_summary')
  const [additionalContext, setAdditionalContext] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [results, setResults] = useState<Record<string, GenerationResult>>({})
  const [activeTab, setActiveTab] = useState('generate')

  const handleGenerate = async () => {
    if (!rfpDocumentUrl) {
      toast({
        title: 'RFP Document Required',
        description: 'Please process the RFP document first',
        variant: 'destructive'
      })
      return
    }

    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          proposal_id: proposalId,
          section: selectedSection,
          rfp_document_url: rfpDocumentUrl,
          rfp_document_name: rfpDocumentName || 'RFP Document',
          additional_context: additionalContext,
          include_analysis: true,
          auto_save: false
        })
      })

      clearInterval(progressInterval)
      setGenerationProgress(100)

      if (!response.ok) {
        throw new Error('Generation failed')
      }

      const result = await response.json()
      
      const newResult: GenerationResult = {
        section: result.data.section,
        content: result.data.content,
        word_count: result.data.word_count,
        win_themes: result.data.win_themes,
        discriminators: result.data.discriminators,
        compliance_score: result.data.compliance_score,
        evaluation_alignment: result.data.evaluation_alignment,
        graphics_recommendations: result.data.graphics_recommendations,
        risks_identified: result.data.risks_identified,
        next_steps: result.data.next_steps
      }

      setResults(prev => ({
        ...prev,
        [selectedSection]: newResult
      }))

      if (onSectionGenerated) {
        onSectionGenerated(selectedSection, newResult.content)
      }

      toast({
        title: 'Generation Complete',
        description: `${getSectionLabel(selectedSection)} generated successfully`
      })

      setActiveTab('results')
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate proposal content',
        variant: 'destructive'
      })
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }

  const handleSaveToProposal = async (section: string) => {
    const result = results[section]
    if (!result) return

    try {
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          proposal_id: proposalId,
          section,
          rfp_document_url: rfpDocumentUrl!,
          rfp_document_name: rfpDocumentName || 'RFP Document',
          auto_save: true
        })
      })

      if (!response.ok) {
        throw new Error('Save failed')
      }

      const data = await response.json()
      
      toast({
        title: 'Content Saved',
        description: 'Proposal section saved successfully'
      })

      if (data.data.proposal_id && !proposalId) {
        router.push(`/proposals/${data.data.proposal_id}`)
      }
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save proposal content',
        variant: 'destructive'
      })
    }
  }

  const getSectionLabel = (value: string) => {
    return SECTIONS.find(s => s.value === value)?.label || value
  }

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'text-green-600'
      case 'adequate': return 'text-yellow-600'
      case 'weak': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          AI Proposal Generator
        </CardTitle>
        <CardDescription>
          Generate winning proposal content using AI analysis of the RFP
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="results" disabled={Object.keys(results).length === 0}>
              Results
            </TabsTrigger>
            <TabsTrigger value="insights" disabled={Object.keys(results).length === 0}>
              Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Select Section to Generate
              </label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map(section => {
                    const Icon = section.icon
                    return (
                      <SelectItem key={section.value} value={section.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {section.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Additional Context (Optional)
              </label>
              <Textarea
                placeholder="Provide any specific instructions, focus areas, or context for the AI..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={4}
              />
            </div>

            {!rfpDocumentUrl && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please process the RFP document first to enable AI generation
                </AlertDescription>
              </Alert>
            )}

            {isGenerating && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Generating content...</span>
                  <span>{generationProgress}%</span>
                </div>
                <Progress value={generationProgress} />
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!rfpDocumentUrl || isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate {getSectionLabel(selectedSection)}
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {Object.entries(results).map(([section, result]) => (
              <Card key={section}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {getSectionLabel(section)}
                      </CardTitle>
                      <CardDescription>
                        {result.word_count} words • 
                        {result.compliance_score && ` ${result.compliance_score}% compliant`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(result.content)}
                      >
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveToProposal(section)}
                      >
                        <Save className="mr-1 h-3 w-3" />
                        Save
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm">
                      {result.content}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {Object.entries(results).map(([section, result]) => (
              <Card key={section}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {getSectionLabel(section)} Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.win_themes && result.win_themes.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Win Themes
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.win_themes.map((theme, i) => (
                          <Badge key={i} variant="secondary">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.discriminators && result.discriminators.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Discriminators
                      </h4>
                      <ul className="text-sm space-y-1">
                        {result.discriminators.map((disc, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle className="h-3 w-3 mt-0.5 text-green-600" />
                            {disc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.evaluation_alignment && (
                    <div>
                      <h4 className="font-medium mb-2">Evaluation Factor Alignment</h4>
                      <div className="space-y-2">
                        {result.evaluation_alignment.map((factor, i) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span>{factor.factor}</span>
                            <span className={getStrengthColor(factor.strength)}>
                              {factor.strength}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.next_steps && result.next_steps.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Next Steps</h4>
                      <ul className="text-sm space-y-1">
                        {result.next_steps.map((step, i) => (
                          <li key={i}>• {step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}