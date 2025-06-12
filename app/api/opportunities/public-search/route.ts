import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { withCache } from '@/lib/sam-gov/cache-strategy'
import { createCacheKey } from '@/lib/utils/cache'
import { calculateOpportunityMatch } from '@/lib/sam-gov/utils'

// Public search endpoint - uses service client for reading opportunities

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') || 'active'
    const q = searchParams.get('q') || ''
    const set_aside = searchParams.get('set_aside') || ''

    // Use service client for reading opportunities (bypasses RLS)
    const serviceClient = createServiceClient()
    
    // Get authenticated client for user-specific data only
    const authClient = await createClient()
    
    // Try to get user's NAICS codes for personalized matching
    let userNaicsCodes: string[] = ['423450', '339112'] // Fallback to medical equipment defaults
    
    try {
      // Try to get the current user and their company NAICS codes
      const { data: { user } } = await authClient.auth.getUser()
      
      if (user) {
        const { data: profile } = await authClient
          .from('profiles')
          .select(`
            company_id,
            companies!inner(naics_codes)
          `)
          .eq('id', user.id)
          .single()
          
        if (profile?.companies) {
          const companyNaics = (profile.companies as any)?.naics_codes || []
          if (companyNaics.length > 0) {
            userNaicsCodes = companyNaics
          }
        }
      }
    } catch (authError) {
      // If authentication fails, continue with default NAICS codes
      console.log('No authentication found, using default medical NAICS codes')
    }
    
    // Create cache key for this search
    const cacheKey = createCacheKey('public-search', {
      limit,
      offset,
      status,
      q,
      set_aside
    })
    
    // Use cache to reduce database queries
    const result = await withCache(
      cacheKey,
      'SEARCH_RESULTS',
      async () => {
        // Build query - Order by newest opportunities first
        // Using service client to bypass RLS for public opportunity reading
        let query = serviceClient
          .from('opportunities')
          .select('*', { count: 'exact' })
          .order('posted_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit)
          .range(offset, offset + limit - 1)
        
        // Add filters
        if (status && status !== 'all') {
          query = query.eq('status', status)
        }
        
        if (q) {
          query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        }
        
        if (set_aside && set_aside !== 'all') {
          query = query.eq('set_aside_type', set_aside)
        }
        
        const { data: opportunities, error, count } = await query
        
        if (error) throw error
        
        return { opportunities, count }
      },
      { ttl: 600 } // Cache for 10 minutes for better performance
    )
    
    const { opportunities, count } = result
    
    // Get user's saved opportunities for isSaved status
    let savedOpportunityIds: string[] = []
    try {
      const { data: { user } } = await authClient.auth.getUser()
      
      if (user) {
        const { data: savedOpportunities } = await authClient
          .from('saved_opportunities')
          .select('opportunity_id')
          .eq('user_id', user.id)
        
        savedOpportunityIds = savedOpportunities?.map(s => s.opportunity_id) || []
      }
    } catch (error) {
      // Continue without saved status if auth fails
      console.log('Could not fetch saved opportunities status')
    }
    
    // Transform opportunities to match expected format with personalized medical matching
    const transformedOpportunities = opportunities?.map(opp => {
      const matchScore = calculateOpportunityMatch(opp, userNaicsCodes)
      return {
        ...opp,
        matchScore: Math.min(matchScore, 1.0), // Keep as decimal (0.0-1.0) and cap at 1.0
        isSaved: savedOpportunityIds.includes(opp.id)
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}