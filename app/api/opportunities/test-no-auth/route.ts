/**
 * Test endpoint to check database without auth
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Use service client to bypass RLS
    const supabase = createServiceClient()
    
    // Simple query to get opportunities
    const { data: opportunities, error, count } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .limit(5)
      .order('posted_date', { ascending: false })
    
    if (error) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      count: count || 0,
      opportunities: opportunities || [],
      message: count === 0 ? 'No opportunities in database' : `Found ${count} opportunities`
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'server_error'
    }, { status: 500 })
  }
}