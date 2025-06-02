/**
 * Opportunity Analysis Button - Trigger AI analysis of an opportunity
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Brain, 
  Loader2, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Target,
  Clock,
  DollarSign,
  Users,
  Lightbulb
} from 'lucide-react'
import { toast } from 'sonner'
import type { IOpportunityAnalysis } from '@/lib/ai/claude-client'

interface IOpportunityAnalysisButtonProps {
  opportunityId: string
  opportunityTitle: string
  trigger?: React.ReactNode
}

export function OpportunityAnalysisButton({ 
  opportunityId, 
  opportunityTitle,
  trigger 
}: IOpportunityAnalysisButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<IOpportunityAnalysis | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [cached, setCached] = useState(false)
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId })
      })

      const result = await response.json()

      if (response.ok) {
        setAnalysis(result.analysis)
        setCached(result.cached)
        setAnalyzedAt(result.analyzedAt)
        
        if (result.cached) {
          toast.info('Showing cached analysis')
        } else {
          toast.success('Analysis completed')
        }
      } else {
        toast.error(result.error || 'Analysis failed')
      }
    } catch (error) {
      console.error('Error analyzing opportunity:', error)
      toast.error('Analysis failed - please try again')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getWinProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-green-600 bg-green-50 border-green-200'
    if (probability >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getCompetitionColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'high': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-600 bg-green-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'high': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Generate Analysis
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Opportunity Analysis
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {opportunityTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!analysis && (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">AI-Powered Analysis</h3>
              <p className="text-muted-foreground mb-4">
                Get intelligent insights about this opportunity including win probability, 
                competition analysis, and strategic recommendations.
              </p>
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing}
                className="flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Start Analysis
                  </>
                )}
              </Button>
            </div>
          )}

          {analysis && (
            <div className="space-y-6">
              {/* Header with key metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Win Probability</span>
                    </div>
                    <div className={`text-2xl font-bold mt-1 px-2 py-1 rounded border ${getWinProbabilityColor(analysis.winProbability)}`}>
                      {analysis.winProbability}%
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Competition Level</span>
                    </div>
                    <Badge className={`mt-1 ${getCompetitionColor(analysis.competitionLevel)}`}>
                      {analysis.competitionLevel.charAt(0).toUpperCase() + analysis.competitionLevel.slice(1)}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Estimated Effort</span>
                    </div>
                    <Badge className={`mt-1 ${getEffortColor(analysis.estimatedEffort)}`}>
                      {analysis.estimatedEffort.charAt(0).toUpperCase() + analysis.estimatedEffort.slice(1)}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Match Reasoning */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Match Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{analysis.matchReasoning}</p>
                </CardContent>
              </Card>

              {/* Key Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Key Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.keyRequirements.map((requirement, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-sm">{requirement}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Strategic Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                        <span className="text-sm">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Risk Factors */}
              {analysis.riskFactors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Risk Factors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.riskFactors.map((risk, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <span className="text-sm">{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Proposal Strategy */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Proposal Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{analysis.proposalStrategy}</p>
                </CardContent>
              </Card>

              {/* Timeline Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Timeline Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{analysis.timelineAnalysis}</p>
                </CardContent>
              </Card>

              {/* Analysis Footer */}
              <Alert>
                <Brain className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {cached ? 'This analysis was cached' : 'Analysis generated'} on{' '}
                  {analyzedAt ? new Date(analyzedAt).toLocaleString() : 'unknown date'}.
                  AI analysis is for guidance only and should be combined with your professional judgment.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}