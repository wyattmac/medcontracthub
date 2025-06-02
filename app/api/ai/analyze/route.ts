/**
 * API Route: AI-powered opportunity analysis
 * POST /api/ai/analyze
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'
import { analyzeOpportunity } from '@/lib/ai/claude-client'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    
    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { opportunityId } = await request.json()

    if (!opportunityId) {
      return NextResponse.json(
        { error: 'Opportunity ID is required' },
        { status: 400 }
      )
    }

    // Get opportunity details
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single()

    if (opportunityError || !opportunity) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      )
    }

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

    const company = profile.companies as any
    
    // Build company profile for AI analysis
    const companyProfile = {
      naicsCodes: company.naics_codes || [],
      capabilities: company.description ? [company.description] : [],
      pastPerformance: [], // Could be expanded to include past contract history
      certifications: company.certifications || [],
      companySize: 'small' // Could be determined from company data
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

    // Generate new AI analysis with timeout
    const analysis = await Promise.race([
      analyzeOpportunity(opportunity, companyProfile),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timeout - please try again')), 45000)
      )
    ])

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
      console.error('Error caching analysis:', insertError)
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
    })

    return NextResponse.json({
      analysis,
      cached: false,
      analyzedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('AI analysis error:', error)
    
    return NextResponse.json(
      { 
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}