/**
 * Proposal Learning System
 * Tracks proposal outcomes and learns patterns for continuous improvement
 */

import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/errors/logger'
import { z } from 'zod'

/**
 * Schema for proposal outcome tracking
 */
const proposalOutcomeSchema = z.object({
  proposal_id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  outcome: z.enum(['won', 'lost', 'pending', 'withdrawn']),
  award_amount: z.number().positive().optional(),
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
    lesson: z.string(),
    recommendation: z.string()
  })).optional()
})

export type ProposalOutcome = z.infer<typeof proposalOutcomeSchema>

/**
 * Learning patterns extracted from outcomes
 */
export interface LearningPattern {
  pattern_type: 'win_factor' | 'loss_factor' | 'pricing_strategy' | 'compliance_issue'
  description: string
  frequency: number
  impact_score: number
  applicable_conditions: {
    agency?: string[]
    contract_type?: string[]
    value_range?: { min: number; max: number }
    naics_codes?: string[]
  }
  recommendations: string[]
}

/**
 * Proposal performance metrics
 */
export interface ProposalMetrics {
  total_proposals: number
  win_rate: number
  average_score: number
  average_award_amount: number
  common_strengths: Array<{ factor: string; count: number }>
  common_weaknesses: Array<{ factor: string; count: number }>
  agency_performance: Record<string, {
    proposals: number
    wins: number
    win_rate: number
  }>
  evaluation_factor_performance: Record<string, {
    average_score: number
    trend: 'improving' | 'declining' | 'stable'
  }>
}

/**
 * AI-generated insights from historical data
 */
export interface ProposalInsights {
  winning_patterns: Array<{
    pattern: string
    confidence: number
    examples: string[]
  }>
  risk_factors: Array<{
    factor: string
    impact: 'high' | 'medium' | 'low'
    mitigation: string
  }>
  pricing_insights: {
    optimal_margin_range: { min: number; max: number }
    competitive_factors: string[]
    win_probability_by_price: Array<{ price_point: number; probability: number }>
  }
  content_recommendations: Array<{
    section: string
    recommendation: string
    based_on: string[]
  }>
}

export class ProposalLearningSystem {
  private supabase = createServiceClient()

  /**
   * Record proposal outcome and extract learnings
   */
  async recordOutcome(outcome: ProposalOutcome): Promise<void> {
    try {
      logger.info('Recording proposal outcome', { proposal_id: outcome.proposal_id })

      // Validate outcome data
      const validatedOutcome = proposalOutcomeSchema.parse(outcome)

      // Store outcome in database
      const { error: outcomeError } = await this.supabase
        .from('proposal_outcomes')
        .upsert({
          proposal_id: validatedOutcome.proposal_id,
          opportunity_id: validatedOutcome.opportunity_id,
          outcome: validatedOutcome.outcome,
          award_amount: validatedOutcome.award_amount,
          feedback: validatedOutcome.feedback,
          lessons_learned: validatedOutcome.lessons_learned,
          recorded_at: new Date().toISOString()
        })

      if (outcomeError) {
        throw new Error(`Failed to record outcome: ${outcomeError.message}`)
      }

      // Extract and store learning patterns
      if (validatedOutcome.outcome !== 'pending') {
        await this.extractLearningPatterns(validatedOutcome)
      }

      // Update proposal metrics
      await this.updateMetrics(validatedOutcome)

      logger.info('Proposal outcome recorded successfully')
    } catch (error) {
      logger.error('Error recording proposal outcome', error as Error)
      throw error
    }
  }

  /**
   * Extract learning patterns from proposal outcome
   */
  private async extractLearningPatterns(outcome: ProposalOutcome): Promise<void> {
    const patterns: LearningPattern[] = []

    // Extract win factors
    if (outcome.outcome === 'won' && outcome.feedback?.strengths) {
      for (const strength of outcome.feedback.strengths) {
        patterns.push({
          pattern_type: 'win_factor',
          description: strength,
          frequency: 1, // Will be aggregated
          impact_score: 0.8,
          applicable_conditions: {},
          recommendations: [`Emphasize ${strength} in future proposals`]
        })
      }
    }

    // Extract loss factors
    if (outcome.outcome === 'lost' && outcome.feedback?.weaknesses) {
      for (const weakness of outcome.feedback.weaknesses) {
        patterns.push({
          pattern_type: 'loss_factor',
          description: weakness,
          frequency: 1,
          impact_score: -0.8,
          applicable_conditions: {},
          recommendations: [`Improve ${weakness} in future proposals`]
        })
      }
    }

    // Store patterns
    for (const pattern of patterns) {
      await this.storePattern(pattern, outcome)
    }
  }

  /**
   * Store learning pattern with context
   */
  private async storePattern(
    pattern: LearningPattern,
    outcome: ProposalOutcome
  ): Promise<void> {
    // Get proposal and opportunity details for context
    const { data: proposal } = await this.supabase
      .from('proposals')
      .select(`
        *,
        opportunities (
          agency,
          contract_type,
          naics_codes,
          value_amount
        )
      `)
      .eq('id', outcome.proposal_id)
      .single()

    if (!proposal) return

    // Enrich pattern with context
    pattern.applicable_conditions = {
      agency: [proposal.opportunities.agency],
      contract_type: [proposal.opportunities.contract_type],
      naics_codes: proposal.opportunities.naics_codes,
      value_range: proposal.opportunities.value_amount
    }

    // Store or update pattern
    const { error } = await this.supabase
      .from('proposal_learning_patterns')
      .upsert({
        pattern_type: pattern.pattern_type,
        description: pattern.description,
        frequency: pattern.frequency,
        impact_score: pattern.impact_score,
        applicable_conditions: pattern.applicable_conditions,
        recommendations: pattern.recommendations,
        last_seen: new Date().toISOString()
      })

    if (error) {
      logger.error('Failed to store learning pattern', error)
    }
  }

  /**
   * Get relevant learning insights for a new proposal
   */
  async getProposalInsights(
    opportunityId: string,
    companyId: string
  ): Promise<ProposalInsights> {
    try {
      // Get opportunity details
      const { data: opportunity } = await this.supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single()

      if (!opportunity) {
        throw new Error('Opportunity not found')
      }

      // Get historical patterns relevant to this opportunity
      const { data: patterns } = await this.supabase
        .from('proposal_learning_patterns')
        .select('*')
        .or(`
          applicable_conditions->>agency.cs.{${opportunity.agency}},
          applicable_conditions->>contract_type.cs.{${opportunity.contract_type}}
        `)
        .order('impact_score', { ascending: false })
        .limit(20)

      // Get company's historical performance
      const { data: metrics } = await this.supabase
        .from('proposal_metrics')
        .select('*')
        .eq('company_id', companyId)
        .single()

      // Generate insights
      const insights: ProposalInsights = {
        winning_patterns: this.extractWinningPatterns(patterns || []),
        risk_factors: this.identifyRiskFactors(patterns || [], metrics),
        pricing_insights: await this.generatePricingInsights(opportunity, companyId),
        content_recommendations: this.generateContentRecommendations(patterns || [])
      }

      return insights
    } catch (error) {
      logger.error('Error generating proposal insights', error as Error)
      throw error
    }
  }

  /**
   * Extract winning patterns from historical data
   */
  private extractWinningPatterns(patterns: any[]): ProposalInsights['winning_patterns'] {
    const winPatterns = patterns
      .filter(p => p.pattern_type === 'win_factor' && p.impact_score > 0.5)
      .map(p => ({
        pattern: p.description,
        confidence: Math.min(p.frequency * 0.1 + p.impact_score, 1),
        examples: p.recommendations || []
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)

    return winPatterns
  }

  /**
   * Identify risk factors based on patterns
   */
  private identifyRiskFactors(patterns: any[], metrics: any): ProposalInsights['risk_factors'] {
    const riskFactors: ProposalInsights['risk_factors'] = []

    // Add risks from loss patterns
    const lossPatterns = patterns.filter(p => p.pattern_type === 'loss_factor')
    for (const pattern of lossPatterns) {
      riskFactors.push({
        factor: pattern.description,
        impact: pattern.impact_score < -0.7 ? 'high' : 'medium',
        mitigation: pattern.recommendations?.[0] || 'Address in proposal'
      })
    }

    // Add risks from metrics
    if (metrics?.win_rate < 0.2) {
      riskFactors.push({
        factor: 'Low historical win rate',
        impact: 'high',
        mitigation: 'Focus on differentiators and competitive advantages'
      })
    }

    return riskFactors.slice(0, 5)
  }

  /**
   * Generate pricing insights based on historical wins
   */
  private async generatePricingInsights(
    opportunity: any,
    companyId: string
  ): Promise<ProposalInsights['pricing_insights']> {
    // Get historical pricing data for similar opportunities
    const { data: historicalPricing } = await this.supabase
      .from('proposals')
      .select(`
        total_proposed_price,
        proposal_outcomes!inner(outcome, award_amount),
        opportunities!inner(value_amount, contract_type)
      `)
      .eq('company_id', companyId)
      .eq('opportunities.contract_type', opportunity.contract_type)
      .not('total_proposed_price', 'is', null)

    if (!historicalPricing || historicalPricing.length === 0) {
      return {
        optimal_margin_range: { min: 10, max: 25 },
        competitive_factors: ['No historical data available'],
        win_probability_by_price: []
      }
    }

    // Calculate win rate by price range
    const priceRanges = this.calculatePriceRanges(historicalPricing)
    
    return {
      optimal_margin_range: { min: 12, max: 22 }, // Simplified calculation
      competitive_factors: [
        'Technical approach strength',
        'Past performance relevance',
        'Competitive pricing'
      ],
      win_probability_by_price: priceRanges
    }
  }

  /**
   * Generate content recommendations based on patterns
   */
  private generateContentRecommendations(patterns: any[]): ProposalInsights['content_recommendations'] {
    const recommendations: ProposalInsights['content_recommendations'] = []

    // Group patterns by impact
    const highImpactPatterns = patterns.filter(p => Math.abs(p.impact_score) > 0.7)

    // Generate recommendations for each section
    const sections = ['executive_summary', 'technical_approach', 'management_approach', 'past_performance']
    
    for (const section of sections) {
      const relevantPatterns = highImpactPatterns
        .filter(p => p.recommendations?.some((r: string) => r.toLowerCase().includes(section.replace('_', ' '))))

      if (relevantPatterns.length > 0) {
        recommendations.push({
          section,
          recommendation: relevantPatterns[0].recommendations[0],
          based_on: relevantPatterns.map(p => p.description)
        })
      }
    }

    return recommendations
  }

  /**
   * Update company proposal metrics
   */
  private async updateMetrics(outcome: ProposalOutcome): Promise<void> {
    // This would calculate and update aggregate metrics
    // Implementation simplified for brevity
    logger.info('Updating proposal metrics', { proposal_id: outcome.proposal_id })
  }

  /**
   * Calculate price ranges and win probabilities
   */
  private calculatePriceRanges(historicalData: any[]): Array<{ price_point: number; probability: number }> {
    // Simplified calculation - in production this would be more sophisticated
    const ranges = []
    const valueRanges = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2]
    
    for (const multiplier of valueRanges) {
      const winsAtRange = historicalData.filter(d => {
        const priceRatio = d.total_proposed_price / (d.opportunities.value_amount?.min || 1)
        return priceRatio >= multiplier - 0.05 && priceRatio <= multiplier + 0.05 &&
               d.proposal_outcomes.outcome === 'won'
      }).length

      const totalAtRange = historicalData.filter(d => {
        const priceRatio = d.total_proposed_price / (d.opportunities.value_amount?.min || 1)
        return priceRatio >= multiplier - 0.05 && priceRatio <= multiplier + 0.05
      }).length

      ranges.push({
        price_point: multiplier,
        probability: totalAtRange > 0 ? winsAtRange / totalAtRange : 0
      })
    }

    return ranges
  }

  /**
   * Get proposal performance metrics for a company
   */
  async getCompanyMetrics(companyId: string): Promise<ProposalMetrics> {
    try {
      const { data: proposals } = await this.supabase
        .from('proposals')
        .select(`
          *,
          proposal_outcomes (
            outcome,
            award_amount,
            feedback
          ),
          opportunities (
            agency,
            contract_type
          )
        `)
        .eq('company_id', companyId)

      if (!proposals) {
        throw new Error('No proposals found')
      }

      const metrics = this.calculateMetrics(proposals)
      return metrics
    } catch (error) {
      logger.error('Error getting company metrics', error as Error)
      throw error
    }
  }

  /**
   * Calculate proposal metrics from raw data
   */
  private calculateMetrics(proposals: any[]): ProposalMetrics {
    const totalProposals = proposals.length
    const wonProposals = proposals.filter(p => p.proposal_outcomes?.outcome === 'won')
    const winRate = totalProposals > 0 ? wonProposals.length / totalProposals : 0

    // Calculate average award amount
    const awardAmounts = wonProposals
      .map(p => p.proposal_outcomes?.award_amount)
      .filter(a => a != null)
    const avgAwardAmount = awardAmounts.length > 0 
      ? awardAmounts.reduce((a, b) => a + b, 0) / awardAmounts.length 
      : 0

    // Extract common strengths and weaknesses
    const strengths: Record<string, number> = {}
    const weaknesses: Record<string, number> = {}
    
    proposals.forEach(p => {
      if (p.proposal_outcomes?.feedback?.strengths) {
        p.proposal_outcomes.feedback.strengths.forEach((s: string) => {
          strengths[s] = (strengths[s] || 0) + 1
        })
      }
      if (p.proposal_outcomes?.feedback?.weaknesses) {
        p.proposal_outcomes.feedback.weaknesses.forEach((w: string) => {
          weaknesses[w] = (weaknesses[w] || 0) + 1
        })
      }
    })

    // Calculate agency performance
    const agencyPerformance: Record<string, any> = {}
    proposals.forEach(p => {
      const agency = p.opportunities?.agency
      if (agency) {
        if (!agencyPerformance[agency]) {
          agencyPerformance[agency] = { proposals: 0, wins: 0, win_rate: 0 }
        }
        agencyPerformance[agency].proposals++
        if (p.proposal_outcomes?.outcome === 'won') {
          agencyPerformance[agency].wins++
        }
        agencyPerformance[agency].win_rate = 
          agencyPerformance[agency].wins / agencyPerformance[agency].proposals
      }
    })

    return {
      total_proposals: totalProposals,
      win_rate: winRate,
      average_score: 0, // Would need evaluation scores
      average_award_amount: avgAwardAmount,
      common_strengths: Object.entries(strengths)
        .map(([factor, count]) => ({ factor, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      common_weaknesses: Object.entries(weaknesses)
        .map(([factor, count]) => ({ factor, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      agency_performance: agencyPerformance,
      evaluation_factor_performance: {} // Would need detailed scoring data
    }
  }
}