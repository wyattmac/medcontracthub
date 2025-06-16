import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { AuthenticationError, ValidationError, NotFoundError } from '@/lib/errors/types'
import { ProposalLearningSystem } from '@/lib/ai/proposal-learning-system'
import { logger } from '@/lib/errors/logger'

// Request validation schema
const recordOutcomeSchema = z.object({
  proposal_id: z.string().uuid('Invalid proposal ID'),
  outcome: z.enum(['won', 'lost', 'withdrawn']),
  award_amount: z.number().positive('Award amount must be positive').optional(),
  feedback: z.object({
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    evaluation_scores: z.record(z.string(), z.number()).optional(),
    debriefing_notes: z.string().optional(),
    competitor_insights: z.array(z.object({
      competitor: z.string(),
      strengths: z.array(z.string()),
      award_amount: z.number().optional()
    })).optional()
  }).optional(),
  lessons_learned: z.array(z.object({
    category: z.enum(['technical', 'management', 'pricing', 'past_performance', 'compliance']),
    lesson: z.string().min(10, 'Lesson must be at least 10 characters'),
    recommendation: z.string().min(10, 'Recommendation must be at least 10 characters')
  })).optional()
})

export const POST = async (request: NextRequest) => {
  try {
  // Authenticate user
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthenticationError('Authentication required')
  }

  // Parse and validate request
  const body = await request.json()
  const validationResult = recordOutcomeSchema.safeParse(body)
  
  if (!validationResult.success) {
    throw new ValidationError('Invalid outcome data', {
      errors: validationResult.error.flatten().fieldErrors
    })
  }

  const outcomeData = validationResult.data

  // Verify user has access to the proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select(`
      id,
      opportunity_id,
      company_id,
      title,
      companies!inner(
        id,
        name
      )
    `)
    .eq('id', outcomeData.proposal_id)
    .single()

  if (proposalError || !proposal) {
    throw new NotFoundError('Proposal not found')
  }

  // Verify user belongs to the company
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.company_id !== proposal.company_id) {
    throw new AuthenticationError('You do not have access to this proposal')
  }

  try {
    // Initialize learning system
    const learningSystem = new ProposalLearningSystem()
    
    // Record the outcome
    await learningSystem.recordOutcome({
      proposal_id: outcomeData.proposal_id,
      opportunity_id: proposal.opportunity_id,
      outcome: outcomeData.outcome,
      award_amount: outcomeData.award_amount,
      feedback: outcomeData.feedback,
      lessons_learned: outcomeData.lessons_learned
    })

    // Update proposal status
    const newStatus = outcomeData.outcome === 'won' ? 'awarded' : 
                     outcomeData.outcome === 'lost' ? 'lost' : 'withdrawn'
    
    await supabase
      .from('proposals')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', outcomeData.proposal_id)

    // Log success
    logger.info('Proposal outcome recorded', {
      proposal_id: outcomeData.proposal_id,
      outcome: outcomeData.outcome,
      company: proposal.companies.name
    })

    return NextResponse.json({
      success: true,
      message: 'Proposal outcome recorded successfully',
      data: {
        proposal_id: outcomeData.proposal_id,
        outcome: outcomeData.outcome,
        status: newStatus
      }
    })

  } catch (error) {
    logger.error('Error recording proposal outcome', error as Error)
    throw error
  }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve outcomes and insights
export const GET = async (request: NextRequest) => {
  try {
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthenticationError('Authentication required')
  }

  // Get user's company
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    throw new NotFoundError('Company profile not found')
  }

  const searchParams = request.nextUrl.searchParams
  const proposalId = searchParams.get('proposal_id')
  const includeInsights = searchParams.get('include_insights') === 'true'

  try {
    if (proposalId) {
      // Get specific proposal outcome
      const { data: outcome, error } = await supabase
        .from('proposal_outcomes')
        .select(`
          *,
          proposals!inner(
            id,
            title,
            company_id,
            opportunities(
              id,
              title,
              agency
            )
          )
        `)
        .eq('proposal_id', proposalId)
        .eq('proposals.company_id', profile.company_id)
        .single()

      if (error || !outcome) {
        throw new NotFoundError('Proposal outcome not found')
      }

      let insights = null
      if (includeInsights && outcome.outcome !== 'pending') {
        const learningSystem = new ProposalLearningSystem()
        insights = await learningSystem.getProposalInsights(
          outcome.proposals.opportunities.id,
          profile.company_id
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          outcome,
          insights
        }
      })
    } else {
      // Get all outcomes for the company with metrics
      const learningSystem = new ProposalLearningSystem()
      const metrics = await learningSystem.getCompanyMetrics(profile.company_id)

      const { data: outcomes, error } = await supabase
        .from('proposal_outcomes')
        .select(`
          *,
          proposals!inner(
            id,
            title,
            company_id,
            opportunities(
              title,
              agency
            )
          )
        `)
        .eq('proposals.company_id', profile.company_id)
        .order('recorded_at', { ascending: false })
        .limit(50)

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        data: {
          outcomes: outcomes || [],
          metrics
        }
      })
    }
  } catch (error) {
    logger.error('Error retrieving proposal outcomes', error as Error)
    throw error
  }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}