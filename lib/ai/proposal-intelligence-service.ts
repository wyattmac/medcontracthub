/**
 * Proposal Intelligence Service
 * Uses Claude API to analyze RFP requirements and generate winning proposal strategies
 */

import Anthropic from '@anthropic-ai/sdk'
import { 
  RFPAnalysisResult,
  ProcessedRFPDocument,
  ExtractedSection,
  EvaluationFactor,
  ComplianceRequirement,
  EvaluationInsight,
  RFPRisk,
  RFPOpportunity,
  RFPStructure
} from '@/types/rfp.types'
import { logger } from '@/lib/errors/logger'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

/**
 * Proposal generation prompts
 */
const PROPOSAL_PROMPTS = {
  ANALYZE_WIN_THEMES: `You are an expert government contracting consultant analyzing an RFP. Based on the evaluation criteria and requirements provided, identify:

1. Win Themes: What are the 3-5 key themes that should run throughout the proposal?
2. Discriminators: What unique capabilities or approaches would set this proposal apart?
3. Hot Buttons: What agency pain points or priorities are evident in the RFP?
4. Competitive Advantages: Based on the requirements, what strengths should be emphasized?

Provide specific, actionable insights that directly address the evaluation criteria.`,

  GENERATE_EXECUTIVE_SUMMARY: `You are a proposal writing expert. Create a compelling executive summary that:

1. Directly addresses the agency's stated needs and objectives
2. Highlights our understanding of their challenges
3. Presents our solution approach aligned with evaluation factors
4. Emphasizes discriminators and past performance
5. Uses active voice and customer-focused language
6. Follows government proposal best practices

Keep it concise (2-3 paragraphs) and impactful.`,

  ANALYZE_EVALUATION_FACTORS: `You are a government contracting expert. Analyze these evaluation factors and provide:

1. Relative Importance: How should proposal effort be allocated across factors?
2. Proof Points Needed: What evidence/examples are required for each factor?
3. Risk Areas: Where might proposals commonly fall short?
4. Scoring Strategy: How to maximize points for each factor?
5. Cross-References: How do factors relate to each other?

Be specific and tactical in your recommendations.`,

  GENERATE_TECHNICAL_APPROACH: `You are a technical proposal writer. Based on the requirements, create a technical approach that:

1. Demonstrates clear understanding of the requirement
2. Provides a detailed solution methodology
3. Addresses all shall/will/must statements
4. Includes risk mitigation strategies
5. Shows innovation while maintaining compliance
6. Uses graphics/diagrams conceptually (describe what should be shown)

Structure the response to directly map to Section L instructions.`,

  IDENTIFY_RISKS_AND_MITIGATIONS: `You are a proposal risk analyst. Review the RFP requirements and identify:

1. Technical Risks: Complex requirements, unclear specifications, aggressive timelines
2. Management Risks: Staffing, coordination, reporting challenges
3. Compliance Risks: Difficult certifications, conflicting requirements
4. Competitive Risks: Incumbent advantages, price pressures

For each risk, provide specific mitigation strategies that can be included in the proposal.`,

  GENERATE_PAST_PERFORMANCE: `You are a past performance writer. Create a relevant past performance write-up that:

1. Directly relates to the current requirement
2. Uses the STAR method (Situation, Task, Action, Result)
3. Quantifies results and improvements
4. Highlights similar challenges overcome
5. Demonstrates capability for this specific contract

Make it compelling and relevant to the evaluation criteria.`,

  PRICING_STRATEGY: `You are a pricing strategist for government contracts. Based on the RFP, recommend:

1. Pricing Structure: FFP, T&M, Cost-Plus, or hybrid approach
2. Price-to-Win Strategy: Competitive positioning recommendations
3. Cost Drivers: Major elements affecting price
4. Value Engineering: Cost reduction opportunities
5. Price Proposal Narrative: Key messages to support pricing

Consider both competitiveness and profitability.`
}

export interface ProposalGenerationRequest {
  rfpDocument: ProcessedRFPDocument
  rfpStructure: RFPStructure
  companyProfile: {
    capabilities: string[]
    pastPerformance: Array<{
      contract: string
      value: number
      description: string
      relevance: string
    }>
    certifications: string[]
    naicsCodes: string[]
  }
  proposalSection: 'executive_summary' | 'technical_approach' | 'management_approach' | 'past_performance' | 'pricing'
  additionalContext?: string
}

export interface ProposalIntelligenceResult {
  winThemes: string[]
  discriminators: string[]
  sectionContent: {
    section: string
    content: string
    wordCount: number
  }
  evaluationAlignment: {
    factor: string
    addressedIn: string[]
    strength: 'strong' | 'adequate' | 'weak'
  }[]
  risks: RFPRisk[]
  opportunities: RFPOpportunity[]
  complianceChecklist: {
    requirement: string
    addressed: boolean
    location?: string
  }[]
  ghostingOpportunities: string[]
  graphicsRecommendations: {
    concept: string
    purpose: string
    placement: string
  }[]
}

export class ProposalIntelligenceService {
  /**
   * Analyze RFP and generate comprehensive proposal intelligence
   */
  async analyzeRFPForProposal(
    rfpDocument: ProcessedRFPDocument,
    rfpStructure: RFPStructure
  ): Promise<RFPAnalysisResult> {
    try {
      logger.info('Starting RFP analysis for proposal intelligence')

      // Extract key sections for analysis
      const sectionL = rfpDocument.sections.find(s => s.sectionNumber === 'L')
      const sectionM = rfpDocument.sections.find(s => s.sectionNumber === 'M')
      
      // Analyze evaluation factors
      const evaluationInsights = await this.analyzeEvaluationFactors(
        sectionM?.content || '',
        rfpStructure.sections.M
      )

      // Extract compliance requirements
      const complianceRequirements = this.extractComplianceRequirements(rfpDocument.sections)

      // Identify risks and opportunities
      const risks = await this.identifyRisks(rfpDocument, rfpStructure)
      const opportunities = await this.identifyOpportunities(rfpDocument, rfpStructure)

      const analysisResult: RFPAnalysisResult = {
        structure: rfpStructure,
        extractionQuality: {
          confidence: rfpDocument.metadata.confidence,
          completeness: this.calculateCompleteness(rfpDocument),
          issues: this.identifyExtractionIssues(rfpDocument)
        },
        complianceRequirements,
        evaluationInsights,
        risks,
        opportunities
      }

      logger.info('RFP analysis completed', {
        requirementsFound: complianceRequirements.length,
        risksIdentified: risks.length,
        opportunitiesFound: opportunities.length
      })

      return analysisResult
    } catch (error) {
      logger.error('Error analyzing RFP', error as Error)
      throw error
    }
  }

  /**
   * Generate proposal content for a specific section
   */
  async generateProposalSection(
    request: ProposalGenerationRequest
  ): Promise<ProposalIntelligenceResult> {
    try {
      logger.info('Generating proposal section', { section: request.proposalSection })

      // Select appropriate prompt based on section
      const prompt = this.getPromptForSection(request.proposalSection)
      
      // Prepare context for Claude
      const context = this.prepareContext(request)

      // Generate content using Claude
      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        temperature: 0.7,
        system: "You are an expert government proposal writer with 20+ years of experience winning federal contracts. You write compelling, compliant proposals that score highly in evaluations.",
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nContext:\n${context}`
          }
        ]
      })

      // Parse and structure the response
      const content = response.content[0].type === 'text' ? response.content[0].text : ''
      
      return this.parseProposalResponse(content, request)
    } catch (error) {
      logger.error('Error generating proposal section', error as Error)
      throw error
    }
  }

  /**
   * Generate win themes based on RFP analysis
   */
  async generateWinThemes(
    rfpAnalysis: RFPAnalysisResult,
    companyProfile: ProposalGenerationRequest['companyProfile']
  ): Promise<string[]> {
    try {
      const context = `
RFP Overview:
- Agency: ${rfpAnalysis.structure.metadata.agency}
- Contract Type: ${rfpAnalysis.structure.metadata.contractType}
- Key Evaluation Factors: ${rfpAnalysis.evaluationInsights.map(e => e.factor).join(', ')}

Company Strengths:
- Capabilities: ${companyProfile.capabilities.join(', ')}
- Certifications: ${companyProfile.certifications.join(', ')}
- Relevant Past Performance: ${companyProfile.pastPerformance.length} contracts

Critical Requirements:
${rfpAnalysis.complianceRequirements
  .filter(r => r.isMandatory)
  .slice(0, 5)
  .map(r => `- ${r.requirement}`)
  .join('\n')}
`

      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        temperature: 0.8,
        system: "You are a proposal strategist specializing in win theme development.",
        messages: [
          {
            role: 'user',
            content: `${PROPOSAL_PROMPTS.ANALYZE_WIN_THEMES}\n\nContext:\n${context}`
          }
        ]
      })

      const themes = this.extractWinThemes(response.content[0])
      return themes
    } catch (error) {
      logger.error('Error generating win themes', error as Error)
      throw error
    }
  }

  /**
   * Analyze evaluation factors with Claude
   */
  private async analyzeEvaluationFactors(
    sectionMContent: string,
    evaluationSection?: any
  ): Promise<EvaluationInsight[]> {
    const context = `
Section M Content:
${sectionMContent}

Structured Evaluation Data:
${JSON.stringify(evaluationSection, null, 2)}
`

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 2000,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: `${PROPOSAL_PROMPTS.ANALYZE_EVALUATION_FACTORS}\n\nContext:\n${context}`
        }
      ]
    })

    return this.parseEvaluationInsights(response.content[0])
  }

  /**
   * Identify risks in the RFP
   */
  private async identifyRisks(
    rfpDocument: ProcessedRFPDocument,
    rfpStructure: RFPStructure
  ): Promise<RFPRisk[]> {
    const context = `
RFP Structure: ${JSON.stringify(rfpStructure.metadata, null, 2)}
Key Dates: ${JSON.stringify(rfpStructure.keyDates, null, 2)}
Page Limitations: ${JSON.stringify(rfpStructure.pageLimit, null, 2)}
Submission Requirements: ${JSON.stringify(rfpStructure.submissionRequirements, null, 2)}

Sample Requirements:
${rfpDocument.sections
  .flatMap(s => s.requirements)
  .slice(0, 10)
  .map(r => `- ${r.text}`)
  .join('\n')}
`

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1500,
      temperature: 0.6,
      messages: [
        {
          role: 'user',
          content: `${PROPOSAL_PROMPTS.IDENTIFY_RISKS_AND_MITIGATIONS}\n\nContext:\n${context}`
        }
      ]
    })

    return this.parseRisks(response.content[0])
  }

  /**
   * Identify opportunities in the RFP
   */
  private async identifyOpportunities(
    rfpDocument: ProcessedRFPDocument,
    rfpStructure: RFPStructure
  ): Promise<RFPOpportunity[]> {
    // Similar to identifyRisks but focused on competitive advantages
    const opportunities: RFPOpportunity[] = []
    
    // Analyze for small business set-asides
    if (rfpStructure.metadata.setAsides?.length > 0) {
      opportunities.push({
        description: 'Small business set-aside opportunity',
        section: 'Eligibility',
        strategy: 'Emphasize small business capabilities and agility',
        competitiveAdvantage: 'Reduced competition from large businesses'
      })
    }

    // Look for innovation opportunities
    const innovationKeywords = ['innovative', 'cutting-edge', 'modern', 'transform']
    const hasInnovationFocus = rfpDocument.extractedText.toLowerCase()
      .split(' ')
      .some(word => innovationKeywords.includes(word))
    
    if (hasInnovationFocus) {
      opportunities.push({
        description: 'Agency seeking innovative solutions',
        section: 'Technical Approach',
        strategy: 'Highlight innovative methodologies and technologies',
        competitiveAdvantage: 'Differentiate with modern approach vs traditional solutions'
      })
    }

    return opportunities
  }

  /**
   * Helper methods for parsing and formatting
   */
  private getPromptForSection(section: string): string {
    const prompts: Record<string, string> = {
      executive_summary: PROPOSAL_PROMPTS.GENERATE_EXECUTIVE_SUMMARY,
      technical_approach: PROPOSAL_PROMPTS.GENERATE_TECHNICAL_APPROACH,
      management_approach: PROPOSAL_PROMPTS.GENERATE_TECHNICAL_APPROACH,
      past_performance: PROPOSAL_PROMPTS.GENERATE_PAST_PERFORMANCE,
      pricing: PROPOSAL_PROMPTS.PRICING_STRATEGY
    }
    return prompts[section] || PROPOSAL_PROMPTS.GENERATE_TECHNICAL_APPROACH
  }

  private prepareContext(request: ProposalGenerationRequest): string {
    return `
RFP Information:
- Agency: ${request.rfpStructure.metadata.agency}
- Title: ${request.rfpStructure.metadata.title}
- Contract Type: ${request.rfpStructure.metadata.contractType}
- NAICS Codes: ${request.rfpStructure.metadata.naicsCodes.join(', ')}

Company Profile:
- Capabilities: ${request.companyProfile.capabilities.join(', ')}
- Certifications: ${request.companyProfile.certifications.join(', ')}
- Relevant Experience: ${request.companyProfile.pastPerformance.length} similar contracts

Section Requirements:
${request.rfpDocument.sections
  .find(s => s.sectionNumber === 'L')
  ?.content || 'Section L not found'}

Evaluation Factors:
${request.rfpDocument.sections
  .find(s => s.sectionNumber === 'M')
  ?.content || 'Section M not found'}

Additional Context:
${request.additionalContext || 'None provided'}
`
  }

  private parseProposalResponse(
    content: string,
    request: ProposalGenerationRequest
  ): ProposalIntelligenceResult {
    // Parse the Claude response and structure it
    const wordCount = content.split(/\s+/).length

    return {
      winThemes: this.extractWinThemes({ type: 'text', text: content }),
      discriminators: this.extractDiscriminators(content),
      sectionContent: {
        section: request.proposalSection,
        content,
        wordCount
      },
      evaluationAlignment: this.analyzeEvaluationAlignment(content, request.rfpStructure),
      risks: [],
      opportunities: [],
      complianceChecklist: this.generateComplianceChecklist(content, request.rfpDocument),
      ghostingOpportunities: this.identifyGhostingOpportunities(content),
      graphicsRecommendations: this.recommendGraphics(request.proposalSection)
    }
  }

  private extractWinThemes(content: any): string[] {
    if (content.type !== 'text') return []
    
    const themes: string[] = []
    const lines = content.text.split('\n')
    
    let inWinThemesSection = false
    for (const line of lines) {
      if (line.toLowerCase().includes('win theme')) {
        inWinThemesSection = true
        continue
      }
      if (inWinThemesSection && line.trim().startsWith('-')) {
        themes.push(line.trim().substring(1).trim())
      }
      if (themes.length >= 5) break
    }
    
    return themes
  }

  private extractDiscriminators(content: string): string[] {
    const discriminators: string[] = []
    const lines = content.split('\n')
    
    let inDiscriminatorsSection = false
    for (const line of lines) {
      if (line.toLowerCase().includes('discriminator')) {
        inDiscriminatorsSection = true
        continue
      }
      if (inDiscriminatorsSection && line.trim().startsWith('-')) {
        discriminators.push(line.trim().substring(1).trim())
      }
      if (discriminators.length >= 5) break
    }
    
    return discriminators
  }

  private parseEvaluationInsights(content: any): EvaluationInsight[] {
    if (content.type !== 'text') return []
    
    // Simple parsing logic - in production this would be more sophisticated
    const insights: EvaluationInsight[] = []
    const sections = content.text.split('\n\n')
    
    for (const section of sections) {
      if (section.includes('Factor:')) {
        insights.push({
          factor: 'Technical Approach',
          importance: 'critical',
          strategy: section,
          requiredProofPoints: [],
          differentiators: []
        })
      }
    }
    
    return insights
  }

  private parseRisks(content: any): RFPRisk[] {
    if (content.type !== 'text') return []
    
    const risks: RFPRisk[] = []
    const lines = content.text.split('\n')
    
    for (const line of lines) {
      if (line.includes('Risk:')) {
        risks.push({
          description: line.replace('Risk:', '').trim(),
          severity: 'medium',
          likelihood: 'medium',
          mitigation: 'To be determined'
        })
      }
    }
    
    return risks
  }

  private calculateCompleteness(document: ProcessedRFPDocument): number {
    const expectedSections = ['L', 'M', 'C']
    const foundSections = document.sections.map(s => s.sectionNumber)
    const found = expectedSections.filter(s => foundSections.includes(s)).length
    return (found / expectedSections.length) * 100
  }

  private identifyExtractionIssues(document: ProcessedRFPDocument): any[] {
    const issues = []
    
    if (!document.sections.find(s => s.sectionNumber === 'L')) {
      issues.push({
        section: 'L',
        issue: 'Instructions to Offerors section not found',
        severity: 'high',
        suggestion: 'Manually review document for Section L content'
      })
    }
    
    if (!document.sections.find(s => s.sectionNumber === 'M')) {
      issues.push({
        section: 'M',
        issue: 'Evaluation Criteria section not found',
        severity: 'high',
        suggestion: 'Manually review document for Section M content'
      })
    }
    
    return issues
  }

  private extractComplianceRequirements(sections: ExtractedSection[]): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = []
    
    for (const section of sections) {
      for (const req of section.requirements) {
        requirements.push({
          id: req.id,
          source: `Section ${section.sectionNumber}`,
          requirement: req.text,
          category: req.category,
          isMandatory: req.type === 'shall' || req.type === 'must',
          verificationMethod: 'Proposal response',
          proposalSection: this.mapRequirementToProposalSection(req.category)
        })
      }
    }
    
    return requirements
  }

  private mapRequirementToProposalSection(category: string): string {
    const mapping: Record<string, string> = {
      technical: 'Technical Approach',
      management: 'Management Approach',
      past_performance: 'Past Performance',
      pricing: 'Price Proposal',
      administrative: 'Executive Summary'
    }
    return mapping[category] || 'Technical Approach'
  }

  private analyzeEvaluationAlignment(
    content: string,
    rfpStructure: RFPStructure
  ): any[] {
    // Analyze how well the generated content aligns with evaluation factors
    const alignment = []
    
    if (rfpStructure.sections.M?.factors) {
      for (const factor of rfpStructure.sections.M.factors) {
        const mentioned = content.toLowerCase().includes(factor.name.toLowerCase())
        alignment.push({
          factor: factor.name,
          addressedIn: mentioned ? ['Generated content'] : [],
          strength: mentioned ? 'adequate' : 'weak'
        })
      }
    }
    
    return alignment
  }

  private generateComplianceChecklist(
    content: string,
    rfpDocument: ProcessedRFPDocument
  ): any[] {
    const checklist = []
    
    // Check if key requirements are addressed in the generated content
    for (const section of rfpDocument.sections) {
      for (const req of section.requirements) {
        if (req.type === 'shall' || req.type === 'must') {
          const addressed = content.toLowerCase().includes(
            req.text.substring(0, 50).toLowerCase()
          )
          checklist.push({
            requirement: req.text.substring(0, 100) + '...',
            addressed,
            location: addressed ? 'Generated content' : undefined
          })
        }
      }
    }
    
    return checklist
  }

  private identifyGhostingOpportunities(content: string): string[] {
    // Identify opportunities to ghost competitors
    const opportunities = []
    
    if (content.includes('incumbent')) {
      opportunities.push('Highlight fresh perspective vs incumbent inertia')
    }
    
    if (content.includes('cost-effective')) {
      opportunities.push('Emphasize value engineering vs low-cost providers')
    }
    
    if (content.includes('innovative')) {
      opportunities.push('Contrast modern approach with traditional methods')
    }
    
    return opportunities
  }

  private recommendGraphics(section: string): any[] {
    const recommendations = []
    
    const graphicsBySection: Record<string, any[]> = {
      technical_approach: [
        {
          concept: 'Solution Architecture Diagram',
          purpose: 'Visualize technical solution components and integration',
          placement: 'After solution overview paragraph'
        },
        {
          concept: 'Implementation Timeline',
          purpose: 'Show phased approach and key milestones',
          placement: 'In schedule/timeline section'
        }
      ],
      management_approach: [
        {
          concept: 'Organizational Chart',
          purpose: 'Display team structure and reporting relationships',
          placement: 'In staffing section'
        },
        {
          concept: 'Risk Matrix',
          purpose: 'Visualize risk assessment and mitigation strategies',
          placement: 'In risk management section'
        }
      ],
      executive_summary: [
        {
          concept: 'Benefits Infographic',
          purpose: 'Highlight key benefits and value proposition',
          placement: 'As sidebar or callout box'
        }
      ]
    }
    
    return graphicsBySection[section] || []
  }
}