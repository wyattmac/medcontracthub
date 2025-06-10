/**
 * Development Save Endpoint - No CSRF Required
 * For testing in development mode only
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { opportunityId, action } = body

    if (!opportunityId || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 })
    }

    // Use service role for development to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Get mock user ID for development
    const mockUserId = 'a7c2f3d4-5e6a-4b3c-8d9e-1f2a3b4c5d6e'

    if (action === 'save') {
      // Check if already saved
      const { data: existing } = await supabase
        .from('saved_opportunities')
        .select('id')
        .eq('user_id', mockUserId)
        .eq('opportunity_id', opportunityId)
        .single()

      if (!existing) {
        // Create new saved opportunity
        const { error: insertError } = await supabase
          .from('saved_opportunities')
          .insert({
            user_id: mockUserId,
            opportunity_id: opportunityId
          })

        if (insertError) {
          console.error('Insert error:', insertError)
          return NextResponse.json({ 
            error: 'Failed to save opportunity',
            details: insertError.message 
          }, { status: 500 })
        }
      }

      return NextResponse.json({ 
        success: true,
        message: 'Opportunity saved successfully'
      })

    } else {
      // action === 'unsave'
      const { error: deleteError } = await supabase
        .from('saved_opportunities')
        .delete()
        .eq('user_id', mockUserId)
        .eq('opportunity_id', opportunityId)

      if (deleteError) {
        console.error('Delete error:', deleteError)
        return NextResponse.json({ 
          error: 'Failed to unsave opportunity',
          details: deleteError.message
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Opportunity unsaved successfully'
      })
    }
  } catch (error) {
    console.error('Save endpoint error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}