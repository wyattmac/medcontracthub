/**
 * API Route: AI-powered company recommendations
 * GET /api/ai/recommendations
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler'
import { generateCompanyRecommendations } from '@/lib/ai/claude-client'

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
    const companyProfile = {
      naicsCodes: company.naics_codes || [],
      capabilities: company.description ? [company.description] : [],
      pastPerformance: [], // Could be expanded
      certifications: company.certifications || [],
      companySize: 'small' // Could be determined from company data
    }

    // Build recent activity summary
    const searchQueries = (recentActivity || [])
      .filter(log => log.action === 'search_opportunities')
      .map(log => (log.changes as Record<string, any>)?.filters?.searchQuery)
      .filter(Boolean)
      .slice(0, 10)

    const viewedOpportunities = (recentActivity || [])
      .filter(log => log.action === 'view_opportunity')
      .slice(0, 10)

    const recentActivitySummary = {
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

    // Generate new recommendations
    const recommendations = await generateCompanyRecommendations(
      savedOpportunities || [],
      companyProfile,
      recentActivitySummary
    )

    // Cache the recommendations
    const { error: insertError } = await supabase
      .from('opportunity_analyses')
      .insert({
        opportunity_id: null, // This is company-wide recommendations
        company_id: profile.company_id,
        analysis_data: recommendations,
        analysis_type: 'company_recommendations',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })

    if (insertError) {
      console.error('Error caching recommendations:', insertError)
      // Continue anyway
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