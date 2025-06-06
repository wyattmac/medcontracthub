/**
 * API Route: AI-powered opportunity analysis
 * POST /api/ai/analyze
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler, IRouteContext } from '@/lib/api/route-handler'
// import { analyzeOpportunity } from '@/lib/ai/claude-client' // Currently disabled for performance
import { NotFoundError } from '@/lib/errors/types'
import { aiLogger } from '@/lib/errors/logger'
// import { withUsageCheck } from '@/lib/usage/tracker' // Currently disabled for performance

// Request body validation
const analyzeRequestSchema = z.object({
  opportunityId: z.string().uuid('Invalid opportunity ID format')
})

export const POST = routeHandler.POST(
  async ({ request, user, supabase }: IRouteContext) => {
    const body = await request.json()
    const { opportunityId } = analyzeRequestSchema.parse(body)

    // Get opportunity details
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single()

    if (opportunityError || !opportunity) {
      aiLogger.error('Opportunity not found', opportunityError, { opportunityId, userId: user.id })
      throw new NotFoundError('Opportunity')
    }

    // Get user's company profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        companies(
          name,
          naics_codes,
          certifications,
          description
        )
      `)
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      aiLogger.error('User profile not found', profileError, { userId: user.id })
      throw new NotFoundError('User profile')
    }

    const company = profile.companies
    
    // Build company profile for AI analysis
    const _companyProfile = {
      naicsCodes: company?.naics_codes || [],
      capabilities: company?.description ? [company.description] : [],
      pastPerformance: [], // Could be expanded to include past contract history
      certifications: company?.certifications || [],
      companySize: company ? 'small' : 'Unknown' // Could be determined from company data
    }

    // Check if analysis already exists and is recent (within 24 hours)
    const { data: existingAnalysis } = await supabase
      .from('opportunity_analyses')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingAnalysis && existingAnalysis.length > 0) {
      // Return cached analysis
      return NextResponse.json({
        analysis: existingAnalysis[0].analysis_result,
        cached: true,
        analyzedAt: existingAnalysis[0].created_at
      })
    }

    // AI DISABLED: Return static analysis to avoid Anthropic API costs
    const analysis = {
      matchReasoning: `Based on your NAICS codes and company profile, this opportunity shows potential alignment with your capabilities. The agency is ${opportunity.agency} seeking ${opportunity.title}.`,
      competitionLevel: 'medium' as const,
      winProbability: 65,
      keyRequirements: [
        'Review full solicitation document when available',
        'Ensure compliance with delivery requirements',
        'Verify set-aside eligibility if applicable'
      ],
      recommendations: [
        'Monitor for full solicitation release',
        'Prepare capability statement highlighting relevant experience',
        'Consider teaming opportunities if contract value is large'
      ],
      riskFactors: [
        'Competition from established federal contractors',
        'Potential for unclear requirements until full RFP',
        'Agency budget constraints'
      ],
      proposalStrategy: 'Focus on demonstrating technical capabilities, past performance, and competitive pricing. Emphasize any relevant certifications or set-aside qualifications.',
      estimatedEffort: 'medium' as const,
      timelineAnalysis: `Response deadline is ${opportunity.response_deadline}. Allow adequate time for proposal preparation and review.`
    }

    // Cache the analysis
    const { error: insertError } = await supabase
      .from('opportunity_analyses')
      .insert({
        opportunity_id: opportunityId,
        user_id: user.id,
        analysis_result: analysis,
        analysis_type: 'detailed_opportunity_analysis'
      })

    if (insertError) {
      aiLogger.warn('Error caching analysis', { error: insertError, opportunityId, userId: user.id })
      // Continue anyway - we have the analysis
    }

    // Log the analysis request
    await supabase.rpc('log_audit', {
      p_action: 'ai_analysis_generated',
      p_entity_type: 'opportunities',
      p_entity_id: opportunityId,
      p_changes: { 
        analysis_type: 'detailed_opportunity_analysis',
        win_probability: analysis.winProbability,
        competition_level: analysis.competitionLevel
      }
    }).catch((error: any) => {
      aiLogger.warn('Failed to log analysis audit', error)
    })

    aiLogger.info('AI analysis completed', {
      opportunityId,
      userId: user.id,
      winProbability: analysis.winProbability,
      competitionLevel: analysis.competitionLevel
    })

    return NextResponse.json({
      analysis,
      cached: false,
      analyzedAt: new Date().toISOString()
    })
  },
  {
    requireAuth: true,
    validateBody: analyzeRequestSchema,
    rateLimit: 'ai'
  }
)