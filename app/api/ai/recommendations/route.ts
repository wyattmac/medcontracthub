/**
 * API Route: AI-powered company recommendations
 * GET /api/ai/recommendations
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler'
// import { generateCompanyRecommendations } from '@/lib/ai/claude-client' // Currently disabled for performance
import { createServiceClient } from '@/lib/supabase/server'

export const GET = routeHandler.GET(
  async ({ user, supabase }) => {
    // Get user's company profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        companies!inner(
          name,
          naics_codes,
          certifications,
          description
        )
      `)
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Company profile not found' },
        { status: 404 }
      )
    }

    const company = profile.companies

    // Get saved opportunities
    const { data: savedOpportunities, error: savedError } = await supabase
      .from('saved_opportunities')
      .select(`
        *,
        opportunities!inner(
          id,
          title,
          agency,
          naics_code,
          naics_description,
          estimated_value_min,
          estimated_value_max,
          response_deadline,
          status
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (savedError) {
      console.error('Error fetching saved opportunities:', savedError)
      return NextResponse.json(
        { error: 'Failed to fetch saved opportunities' },
        { status: 500 }
      )
    }

    // Get recent activity (audit logs)
    const { data: recentActivity } = await supabase
      .from('audit_logs')
      .select('action, changes')
      .eq('user_id', user.id)
      .in('action', ['search_opportunities', 'view_opportunity', 'save_opportunity'])
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('created_at', { ascending: false })
      .limit(50)

    // Build company profile
    const _companyProfile = {
      naicsCodes: company.naics_codes || [],
      capabilities: company.description ? [company.description] : [],
      pastPerformance: [], // Could be expanded
      certifications: company.certifications || [],
      companySize: 'small' // Could be determined from company data
    }

    // Define type for audit log
    interface AuditLog {
      action: string
      changes: Record<string, any> | null
      [key: string]: any
    }

    // Build recent activity summary
    const searchQueries = (recentActivity || [])
      .filter((log: AuditLog) => log.action === 'search_opportunities')
      .map((log: AuditLog) => (log.changes as Record<string, any>)?.filters?.searchQuery)
      .filter((query: any): query is string => typeof query === 'string' && Boolean(query))
      .slice(0, 10)

    const viewedOpportunities = (recentActivity || [])
      .filter((log: AuditLog) => log.action === 'view_opportunity')
      .slice(0, 10)

    const recentActivitySummary: {
      searchQueries: string[]
      viewedOpportunities: any[]
      savedCount: number
    } = {
      searchQueries: Array.from(new Set(searchQueries)), // Remove duplicates
      viewedOpportunities,
      savedCount: savedOpportunities?.length || 0
    }

    // Check for cached recommendations (within 7 days)
    const { data: cachedRecommendations } = await supabase
      .from('opportunity_analyses')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('analysis_type', 'company_recommendations')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (cachedRecommendations && cachedRecommendations.length > 0) {
      return NextResponse.json({
        recommendations: cachedRecommendations[0].analysis_data,
        cached: true,
        generatedAt: cachedRecommendations[0].created_at,
        basedOn: {
          savedOpportunities: savedOpportunities?.length || 0,
          recentActivity: recentActivitySummary
        }
      })
    }

    // AI DISABLED: Return static recommendations to avoid Anthropic API costs
    const recommendations = {
      highPriorityOpportunities: (savedOpportunities || [])
        .filter(opp => opp.opportunities?.status === 'active')
        .slice(0, 3)
        .map(opp => ({
          opportunityId: opp.opportunities?.id || '',
          reasoning: `High match for ${company.naics_codes?.[0] || 'your industry'} - review deadline and requirements`,
          urgency: 'high' as const
        })),
      industryTrends: [
        'Medical device procurement increasing by 15% in federal sector',
        'Emphasis on domestic manufacturing capabilities',
        'Growing demand for telehealth support equipment'
      ],
      capabilityGaps: [
        'Consider expanding into adjacent NAICS codes',
        'Explore small business certifications for set-aside opportunities'
      ],
      marketInsights: [
        `You have ${savedOpportunities?.length || 0} saved opportunities - prioritize active ones`,
        'Federal medical procurement peaks in Q4 - prepare early'
      ],
      actionableRecommendations: [
        'Review saved opportunities with upcoming deadlines',
        'Update company profile with recent certifications',
        'Set up alerts for high-value opportunities in your NAICS codes'
      ]
    }

    // Cache the recommendations using service client to bypass RLS
    try {
      const serviceClient = createServiceClient()
      await serviceClient
        .from('opportunity_analyses')
        .insert({
          opportunity_id: null, // This is company-wide recommendations
          company_id: profile.company_id,
          analysis_data: recommendations,
          analysis_type: 'company_recommendations',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        })
    } catch (insertError) {
      console.error('Error caching recommendations:', insertError)
      // Continue anyway - don't fail the request
    }

    return NextResponse.json({
      recommendations,
      cached: false,
      generatedAt: new Date().toISOString(),
      basedOn: {
        savedOpportunities: savedOpportunities?.length || 0,
        recentActivity: recentActivitySummary
      }
    })
  },
  { 
    requireAuth: true,
    rateLimit: 'ai'
  }
)