import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Debug endpoint to check opportunities
export async function GET() {
  try {
    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Count all opportunities
    const { count: totalCount } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
    
    // Count by status
    const { data: statusCounts } = await supabase
      .from('opportunities')
      .select('status')
      .order('status')
    
    const statusBreakdown = statusCounts?.reduce((acc: any, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {})
    
    // Get first 5 opportunities
    const { data: samples } = await supabase
      .from('opportunities')
      .select('id, title, status, posted_date, created_at, naics_code')
      .limit(5)
      .order('created_at', { ascending: false })
    
    // Check if using auth client returns different results
    const authSupabase = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { count: authCount } = await authSupabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      totalCount,
      authCount,
      statusBreakdown,
      samples,
      rlsEnabled: totalCount !== authCount,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co') ? 'Supabase Cloud' : 'Local/Docker'
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}