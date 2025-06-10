/**
 * Direct opportunities endpoint that bypasses cache and auth
 * For testing and development
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateOpportunityMatch } from '@/lib/sam-gov/utils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') || 'active'
    const q = searchParams.get('q') || ''
    
    // Use service client to bypass RLS
    const supabase = createServiceClient()
    
    // Build query
    let query = supabase
      .from('opportunities')
      .select('*', { count: 'exact' })
      .order('posted_date', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)
    
    // Add filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    }
    
    const { data: opportunities, error, count } = await query
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: 500 })
    }
    
    // Default medical NAICS codes
    const userNaicsCodes = ['423450', '339112', '621999']
    
    // Transform opportunities with match scores
    const transformedOpportunities = opportunities?.map(opp => {
      const matchScore = calculateOpportunityMatch(opp, userNaicsCodes)
      return {
        ...opp,
        matchScore: Math.min(matchScore, 1.0),
        isSaved: false
      }
    }) || []
    
    return NextResponse.json({
      opportunities: transformedOpportunities,
      totalCount: count || 0,
      total: count || 0,
      count: transformedOpportunities.length,
      hasMore: (offset + limit) < (count || 0),
      quotaStatus: {
        remaining: 756,
        total: 1000,
        warningThreshold: 200
      }
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}