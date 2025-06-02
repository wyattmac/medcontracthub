/**
 * API Route: Search opportunities
 * GET /api/opportunities/search
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'
import { getOpportunitiesFromDatabase, calculateOpportunityMatch } from '@/lib/sam-gov/utils'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const filters = {
      searchQuery: searchParams.get('q') || undefined,
      naicsCodes: searchParams.get('naics')?.split(',').filter(Boolean) || undefined,
      state: searchParams.get('state') || undefined,
      status: searchParams.get('status') as 'active' | 'awarded' | 'cancelled' | 'expired' || undefined,
      responseDeadlineFrom: searchParams.get('deadline_from') || undefined,
      responseDeadlineTo: searchParams.get('deadline_to') || undefined,
      limit: parseInt(searchParams.get('limit') || '25'),
      offset: parseInt(searchParams.get('offset') || '0')
    }

    // Get user's company NAICS codes for match scoring
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        company_id,
        companies!inner(naics_codes)
      `)
      .eq('id', user.id)
      .single()

    const companyNaicsCodes = (profile?.companies as any)?.naics_codes || []

    // If no specific NAICS filter and user has company NAICS codes, use those
    if (!filters.naicsCodes && companyNaicsCodes.length > 0) {
      filters.naicsCodes = companyNaicsCodes
    }

    // Search opportunities
    const { data: opportunities, error, count } = await getOpportunitiesFromDatabase(filters)

    if (error) {
      console.error('Database search error:', error)
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      )
    }

    // Calculate match scores and enhance data
    const enhancedOpportunities = (opportunities || []).map(opportunity => {
      const matchScore = calculateOpportunityMatch(opportunity, companyNaicsCodes)
      
      return {
        ...opportunity,
        matchScore,
        isSaved: opportunity.saved_opportunities?.length > 0
      }
    })

    // Sort by match score (highest first) then by response deadline
    enhancedOpportunities.sort((a, b) => {
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore
      }
      return new Date(a.response_deadline).getTime() - new Date(b.response_deadline).getTime()
    })

    // Log search activity
    if (filters.searchQuery || filters.naicsCodes) {
      await supabase.rpc('log_audit', {
        p_action: 'search_opportunities',
        p_entity_type: 'opportunities',
        p_changes: { filters, resultCount: enhancedOpportunities.length }
      })
    }

    return NextResponse.json({
      opportunities: enhancedOpportunities,
      totalCount: count || 0,
      hasMore: (filters.offset + filters.limit) < (count || 0),
      nextOffset: enhancedOpportunities.length === filters.limit ? filters.offset + filters.limit : null,
      filters
    })

  } catch (error) {
    console.error('Search opportunities error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}