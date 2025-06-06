import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withCache } from '@/lib/sam-gov/cache-strategy'
import { createCacheKey } from '@/lib/utils/cache'

// Create service role client to bypass RLS
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') || 'active'
    const q = searchParams.get('q') || ''
    const set_aside = searchParams.get('set_aside') || ''
    
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
        let query = serviceSupabase
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
      { ttl: 300 } // Cache for 5 minutes
    )
    
    const { opportunities, count } = result
    
    // Transform opportunities to match expected format
    const transformedOpportunities = opportunities?.map(opp => ({
      ...opp,
      matchScore: Math.floor(Math.random() * 40) + 60, // Mock match score
      isSaved: false
    })) || []
    
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