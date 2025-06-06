/**
 * Simple test endpoint to debug opportunities API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Test database connection
    const { data: opportunities, error: oppError, count } = await supabase
      .from('opportunities')
      .select('id, title, status', { count: 'exact' })
      .limit(10)
    
    return NextResponse.json({
      success: true,
      database_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      opportunities: {
        count: count || 0,
        data: opportunities || [],
        error: oppError?.message,
        error_code: oppError?.code,
        error_details: oppError?.details
      }
    })
    
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}