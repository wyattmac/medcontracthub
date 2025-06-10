/**
 * AI Proposal Generation API Endpoint
 * Generates proposal content using RFP analysis and company profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/api/error-interceptor'
import { createServiceClient } from '@/lib/supabase/server'
import { UnauthorizedError, ValidationError, NotFoundError } from '@/lib/errors/types'
import { RFPDocumentProcessor } from '@/lib/ai/rfp-document-processor'
import { ProposalIntelligenceService } from '@/lib/ai/proposal-intelligence-service'
import { logger } from '@/lib/errors/logger'
import type { ProposalGenerationRequest } from '@/lib/ai/proposal-intelligence-service'

// Request validation schema
const generateProposalSchema = z.object({
  opportunity_id: z.string().uuid('Invalid opportunity ID'),
  proposal_id: z.string().uuid('Invalid proposal ID').optional(),
  section: z.enum([
    'executive_summary',
    'technical_approach',
    'management_approach',
    'past_performance',
    'pricing',
    'full_proposal'
  ]),
  rfp_document_url: z.string().url('Invalid RFP document URL'),
  rfp_document_name: z.string().min(1, 'Document name required'),
  additional_context: z.string().max(5000).optional(),
  include_analysis: z.boolean().default(true),
  auto_save: z.boolean().default(false)
})

// Response type
interface GenerationResponse {
  success: boolean
  data: {
    proposal_id?: string
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
  metadata?: {
    processing_time_ms: number
    ai_model: string
    tokens_used?: number
  }
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const startTime = Date.now()
  
  // Authenticate user
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new UnauthorizedError('Authentication required')
  }

  // Parse and validate request
  const body = await request.json()
  const validationResult = generateProposalSchema.safeParse(body)
  
  if (!validationResult.success) {
    throw new ValidationError('Invalid request data', {
      errors: validationResult.error.flatten().fieldErrors
    })
  }

  const {
    opportunity_id,
    proposal_id,
    section,
    rfp_document_url,
    rfp_document_name,
    additional_context,
    include_analysis,
    auto_save
  } = validationResult.data

  try {
    // Get user's company profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        company_id,
        companies (
          id,
          name,
          capabilities,
          certifications,
          naics_codes,
          past_performance
        )
      `)
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.companies) {
      throw new NotFoundError('Company profile not found')
    }

    // Verify access to opportunity
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunity_id)
      .single()

    if (oppError || !opportunity) {
      throw new NotFoundError('Opportunity not found')
    }

    // Initialize services
    const rfpProcessor = new RFPDocumentProcessor()
    const intelligenceService = new ProposalIntelligenceService()

    logger.info('Starting proposal generation', {
      opportunity_id,
      section,
      company_id: profile.company_id
    })

    // Process RFP document
    const processedRFP = await rfpProcessor.processRFPDocument(
      rfp_document_url,
      rfp_document_name
    )

    // Extract detailed RFP structure
    const rfpStructure = {
      sections: {},
      keyDates: {
        proposalDeadline: new Date(opportunity.response_deadline)
      },
      volumes: [],
      pageLimit: await rfpProcessor.extractPageLimits(processedRFP.extractedText),
      submissionRequirements: await rfpProcessor.extractSubmissionRequirements(
        processedRFP.extractedText
      ),
      metadata: {
        agency: opportunity.agency,
        contractType: opportunity.contract_type || 'supply',
        solicitationNumber: opportunity.solicitation_number,
        title: opportunity.title,
        naicsCodes: opportunity.naics_codes || [],
        setAsides: opportunity.set_aside_types || []
      }
    }

    // Extract Section L and M specifically
    const sectionL = await rfpProcessor.extractSection(processedRFP.extractedText, 'L')
    const sectionM = await rfpProcessor.extractSection(processedRFP.extractedText, 'M')
    
    if (sectionL) rfpStructure.sections.L = sectionL
    if (sectionM) rfpStructure.sections.M = sectionM

    // Analyze RFP if requested
    let rfpAnalysis
    if (include_analysis) {
      rfpAnalysis = await intelligenceService.analyzeRFPForProposal(
        processedRFP,
        rfpStructure
      )
    }

    // Prepare company profile for proposal generation
    const companyProfile: ProposalGenerationRequest['companyProfile'] = {
      capabilities: profile.companies.capabilities || [],
      certifications: profile.companies.certifications || [],
      naicsCodes: profile.companies.naics_codes || [],
      pastPerformance: profile.companies.past_performance || []
    }

    // Generate proposal content
    let proposalResult
    if (section === 'full_proposal') {
      // Generate all sections
      const sections = ['executive_summary', 'technical_approach', 'management_approach', 'past_performance']
      const allSections = []
      
      for (const sectionType of sections) {
        const sectionResult = await intelligenceService.generateProposalSection({
          rfpDocument: processedRFP,
          rfpStructure,
          companyProfile,
          proposalSection: sectionType as any,
          additionalContext
        })
        allSections.push(sectionResult)
      }
      
      // Combine results
      proposalResult = {
        sectionContent: {
          section: 'full_proposal',
          content: allSections.map(s => s.sectionContent.content).join('\n\n'),
          wordCount: allSections.reduce((sum, s) => sum + s.sectionContent.wordCount, 0)
        },
        winThemes: allSections[0].winThemes,
        discriminators: allSections[0].discriminators,
        evaluationAlignment: allSections[0].evaluationAlignment,
        risks: rfpAnalysis?.risks || [],
        opportunities: rfpAnalysis?.opportunities || [],
        complianceChecklist: allSections[0].complianceChecklist,
        ghostingOpportunities: allSections[0].ghostingOpportunities,
        graphicsRecommendations: allSections.flatMap(s => s.graphicsRecommendations)
      }
    } else {
      // Generate specific section
      proposalResult = await intelligenceService.generateProposalSection({
        rfpDocument: processedRFP,
        rfpStructure,
        companyProfile,
        proposalSection: section as any,
        additionalContext
      })
    }

    // Generate win themes if not already included
    if (!proposalResult.winThemes?.length && rfpAnalysis) {
      proposalResult.winThemes = await intelligenceService.generateWinThemes(
        rfpAnalysis,
        companyProfile
      )
    }

    // Auto-save to proposal if requested
    let savedProposalId = proposal_id
    if (auto_save) {
      if (proposal_id) {
        // Update existing proposal section
        const { data: existingSection } = await supabase
          .from('proposal_sections')
          .select('id')
          .eq('proposal_id', proposal_id)
          .eq('section_type', section)
          .single()

        if (existingSection) {
          // Update existing section
          await supabase
            .from('proposal_sections')
            .update({
              content: proposalResult.sectionContent.content,
              word_count: proposalResult.sectionContent.wordCount,
              ai_generated: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingSection.id)
        } else {
          // Create new section
          await supabase
            .from('proposal_sections')
            .insert({
              proposal_id,
              section_type: section,
              title: formatSectionTitle(section),
              content: proposalResult.sectionContent.content,
              word_count: proposalResult.sectionContent.wordCount,
              ai_generated: true,
              sort_order: getSectionOrder(section)
            })
        }
      } else {
        // Create new proposal
        const { data: newProposal } = await supabase
          .from('proposals')
          .insert({
            opportunity_id,
            company_id: profile.company_id,
            created_by: user.id,
            title: `AI-Generated Proposal - ${opportunity.title}`,
            status: 'draft',
            win_themes: proposalResult.winThemes,
            discriminators: proposalResult.discriminators,
            ai_metadata: {
              generation_date: new Date().toISOString(),
              rfp_analysis: rfpAnalysis,
              compliance_score: calculateComplianceScore(proposalResult.complianceChecklist)
            }
          })
          .select()
          .single()

        if (newProposal) {
          savedProposalId = newProposal.id
          
          // Save the section
          await supabase
            .from('proposal_sections')
            .insert({
              proposal_id: newProposal.id,
              section_type: section,
              title: formatSectionTitle(section),
              content: proposalResult.sectionContent.content,
              word_count: proposalResult.sectionContent.wordCount,
              ai_generated: true,
              sort_order: getSectionOrder(section)
            })
        }
      }
    }

    // Prepare response
    const response: GenerationResponse = {
      success: true,
      data: {
        proposal_id: savedProposalId,
        section: section,
        content: proposalResult.sectionContent.content,
        word_count: proposalResult.sectionContent.wordCount,
        win_themes: proposalResult.winThemes,
        discriminators: proposalResult.discriminators,
        compliance_score: calculateComplianceScore(proposalResult.complianceChecklist),
        evaluation_alignment: proposalResult.evaluationAlignment.map(e => ({
          factor: e.factor,
          addressed: e.addressedIn.length > 0,
          strength: e.strength
        })),
        graphics_recommendations: proposalResult.graphicsRecommendations,
        risks_identified: proposalResult.risks?.map(r => ({
          description: r.description,
          severity: r.severity,
          mitigation: r.mitigation
        })),
        next_steps: generateNextSteps(section, proposalResult)
      },
      metadata: {
        processing_time_ms: Date.now() - startTime,
        ai_model: 'claude-3-opus-20240229'
      }
    }

    logger.info('Proposal generation completed', {
      opportunity_id,
      section,
      processing_time_ms: response.metadata?.processing_time_ms,
      word_count: response.data.word_count
    })

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    logger.error('Error generating proposal', error as Error, {
      opportunity_id,
      section
    })
    throw error
  }
}, {
  requireAuth: true,
  rateLimit: {
    requests: 20,
    windowMs: 60 * 60 * 1000 // 20 generations per hour
  }
})

// Helper functions
function formatSectionTitle(section: string): string {
  const titles: Record<string, string> = {
    executive_summary: 'Executive Summary',
    technical_approach: 'Technical Approach',
    management_approach: 'Management Approach',
    past_performance: 'Past Performance',
    pricing: 'Price Proposal',
    full_proposal: 'Complete Proposal'
  }
  return titles[section] || section
}

function getSectionOrder(section: string): number {
  const order: Record<string, number> = {
    executive_summary: 1,
    technical_approach: 2,
    management_approach: 3,
    past_performance: 4,
    pricing: 5
  }
  return order[section] || 99
}

function calculateComplianceScore(checklist?: any[]): number {
  if (!checklist || checklist.length === 0) return 0
  
  const addressed = checklist.filter(item => item.addressed).length
  return Math.round((addressed / checklist.length) * 100)
}

function generateNextSteps(section: string, result: any): string[] {
  const steps = []
  
  // Generic steps
  steps.push('Review and customize generated content for your specific approach')
  steps.push('Add specific examples and quantifiable results')
  
  // Section-specific steps
  if (section === 'technical_approach') {
    steps.push('Add technical diagrams and solution architecture')
    steps.push('Include detailed implementation timeline')
  } else if (section === 'management_approach') {
    steps.push('Add organizational chart and key personnel resumes')
    steps.push('Detail quality control and risk management processes')
  } else if (section === 'past_performance') {
    steps.push('Add CPARS ratings and customer references')
    steps.push('Include specific metrics and performance data')
  }
  
  // Compliance-based steps
  if (result.complianceChecklist) {
    const unaddressed = result.complianceChecklist.filter((i: any) => !i.addressed)
    if (unaddressed.length > 0) {
      steps.push(`Address ${unaddressed.length} remaining compliance requirements`)
    }
  }
  
  // Risk-based steps
  if (result.risks?.length > 0) {
    steps.push('Develop detailed risk mitigation strategies')
  }
  
  return steps
}