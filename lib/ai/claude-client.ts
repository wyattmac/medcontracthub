/**
 * Claude AI Client - Handle AI-powered analysis and recommendations
 */

import Anthropic from '@anthropic-ai/sdk'

// Initialize Claude client with timeout configuration
const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30000, // 30 seconds timeout
  maxRetries: 2, // Retry failed requests up to 2 times
})

export interface IOpportunityAnalysis {
  matchReasoning: string
  competitionLevel: 'low' | 'medium' | 'high'
  winProbability: number
  keyRequirements: string[]
  recommendations: string[]
  riskFactors: string[]
  proposalStrategy: string
  estimatedEffort: 'low' | 'medium' | 'high'
  timelineAnalysis: string
}

export interface ICompanyRecommendations {
  highPriorityOpportunities: Array<{
    opportunityId: string
    reasoning: string
    urgency: 'high' | 'medium' | 'low'
  }>
  industryTrends: string[]
  capabilityGaps: string[]
  marketInsights: string[]
  actionableRecommendations: string[]
}

/**
 * Analyze a specific opportunity for a company
 */
export async function analyzeOpportunity(
  opportunity: any,
  companyProfile: {
    naicsCodes: string[]
    capabilities: string[]
    pastPerformance: string[]
    certifications: string[]
    companySize: string
  }
): Promise<IOpportunityAnalysis> {
  const prompt = `
You are an expert federal contracting analyst specializing in medical supply contracts. Analyze this opportunity for the given company profile.

OPPORTUNITY:
Title: ${opportunity.title}
Agency: ${opportunity.agency}
Description: ${opportunity.description || 'No description provided'}
NAICS Code: ${opportunity.naics_code} - ${opportunity.naics_description || ''}
Set-Aside Type: ${opportunity.set_aside_type || 'None specified'}
Estimated Value: $${opportunity.estimated_value_min || 'TBD'} - $${opportunity.estimated_value_max || 'TBD'}
Location: ${opportunity.place_of_performance_city || ''}, ${opportunity.place_of_performance_state || ''}
Deadline: ${opportunity.response_deadline}
Solicitation: ${opportunity.solicitation_number || 'TBD'}

COMPANY PROFILE:
NAICS Codes: ${companyProfile.naicsCodes.join(', ')}
Capabilities: ${companyProfile.capabilities.join(', ')}
Past Performance: ${companyProfile.pastPerformance.join(', ')}
Certifications: ${companyProfile.certifications.join(', ')}
Company Size: ${companyProfile.companySize}

ANALYSIS REQUIRED:
Please provide a detailed analysis in JSON format with the following structure:
{
  "matchReasoning": "Detailed explanation of why this is or isn't a good match",
  "competitionLevel": "low|medium|high",
  "winProbability": 0-100,
  "keyRequirements": ["requirement1", "requirement2", ...],
  "recommendations": ["actionable recommendation1", "recommendation2", ...],
  "riskFactors": ["risk1", "risk2", ...],
  "proposalStrategy": "High-level strategy for winning this contract",
  "estimatedEffort": "low|medium|high",
  "timelineAnalysis": "Analysis of deadlines and time constraints"
}

Focus on:
1. NAICS code alignment
2. Set-aside opportunities 
3. Geographic considerations
4. Company size requirements
5. Technical capabilities match
6. Past performance relevance
7. Realistic assessment of competition
8. Specific recommendations for proposal approach
`

  try {
    const response = await claude.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      // Parse JSON response
      const analysisText = content.text
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]) as IOpportunityAnalysis
        return analysis
      }
    }

    throw new Error('Failed to parse AI response')
  } catch (error) {
    console.error('Error analyzing opportunity:', error)
    
    // Return fallback analysis
    return {
      matchReasoning: 'Unable to perform detailed analysis at this time.',
      competitionLevel: 'medium',
      winProbability: 50,
      keyRequirements: ['Review opportunity details carefully'],
      recommendations: ['Conduct manual analysis'],
      riskFactors: ['Analysis service unavailable'],
      proposalStrategy: 'Standard approach recommended',
      estimatedEffort: 'medium',
      timelineAnalysis: 'Review deadline carefully'
    }
  }
}

/**
 * Generate company-specific recommendations based on saved opportunities and trends
 */
export async function generateCompanyRecommendations(
  savedOpportunities: any[],
  companyProfile: {
    naicsCodes: string[]
    capabilities: string[]
    pastPerformance: string[]
    certifications: string[]
    companySize: string
  },
  recentActivity: {
    searchQueries: string[]
    viewedOpportunities: any[]
    savedCount: number
  }
): Promise<ICompanyRecommendations> {
  const prompt = `
You are a strategic federal contracting advisor for medical supply companies. Based on the company's profile and recent activity, provide strategic recommendations.

COMPANY PROFILE:
NAICS Codes: ${companyProfile.naicsCodes.join(', ')}
Capabilities: ${companyProfile.capabilities.join(', ')}
Past Performance: ${companyProfile.pastPerformance.join(', ')}
Certifications: ${companyProfile.certifications.join(', ')}
Company Size: ${companyProfile.companySize}

RECENT ACTIVITY:
- Saved ${recentActivity.savedCount} opportunities
- Recent searches: ${recentActivity.searchQueries.join(', ')}
- Viewed opportunities: ${recentActivity.viewedOpportunities.length} different contracts

SAVED OPPORTUNITIES SUMMARY:
${savedOpportunities.map(opp => `
- ${opp.opportunity.title} (${opp.opportunity.agency})
  NAICS: ${opp.opportunity.naics_code}
  Value: $${opp.opportunity.estimated_value_min || 'TBD'} - $${opp.opportunity.estimated_value_max || 'TBD'}
  Deadline: ${opp.opportunity.response_deadline}
  Pursuing: ${opp.is_pursuing ? 'Yes' : 'No'}
`).join('')}

Please provide strategic recommendations in JSON format:
{
  "highPriorityOpportunities": [
    {
      "opportunityId": "id",
      "reasoning": "why this should be prioritized",
      "urgency": "high|medium|low"
    }
  ],
  "industryTrends": ["trend1", "trend2", ...],
  "capabilityGaps": ["gap1", "gap2", ...],
  "marketInsights": ["insight1", "insight2", ...],
  "actionableRecommendations": ["action1", "action2", ...]
}

Focus on:
1. Which saved opportunities to prioritize and why
2. Market trends in medical supply contracting
3. Capability gaps that could be addressed
4. Strategic insights based on activity patterns
5. Specific, actionable next steps
6. Competitive positioning advice
7. Growth opportunities in adjacent markets
`

  try {
    const response = await claude.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 2000,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const recommendationsText = content.text
      const jsonMatch = recommendationsText.match(/\{[\s\S]*\}/)
      
      if (jsonMatch) {
        const recommendations = JSON.parse(jsonMatch[0]) as ICompanyRecommendations
        return recommendations
      }
    }

    throw new Error('Failed to parse AI response')
  } catch (error) {
    console.error('Error generating recommendations:', error)
    
    // Return fallback recommendations
    return {
      highPriorityOpportunities: [],
      industryTrends: ['AI analysis temporarily unavailable'],
      capabilityGaps: ['Manual review recommended'],
      marketInsights: ['Consult industry reports'],
      actionableRecommendations: ['Review saved opportunities manually']
    }
  }
}

/**
 * Generate a quick summary of an opportunity for list views
 */
export async function generateOpportunitySummary(opportunity: any): Promise<string> {
  const prompt = `
Provide a concise 1-2 sentence summary of this federal contracting opportunity for medical supply companies:

Title: ${opportunity.title}
Agency: ${opportunity.agency}
Description: ${opportunity.description?.substring(0, 500) || 'No description'}
NAICS: ${opportunity.naics_code}
Value: $${opportunity.estimated_value_min || 'TBD'} - $${opportunity.estimated_value_max || 'TBD'}

Focus on what the agency is buying and key requirements. Keep it under 200 characters.
`

  try {
    const response = await claude.messages.create({
      model: 'claude-3-5-haiku-latest', // Use faster model for summaries
      max_tokens: 150,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return content.text.trim()
    }

    return 'Unable to generate summary'
  } catch (error) {
    console.error('Error generating summary:', error)
    return 'Summary unavailable'
  }
}

export { claude }