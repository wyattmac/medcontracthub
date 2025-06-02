/**
 * API Route: Save/unsave opportunities
 * POST /api/opportunities/save
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'

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

    const { opportunityId, action, notes = null, tags = [], isPursuing = false, reminderDate = null } = await request.json()

    if (!opportunityId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify opportunity exists
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .select('id')
      .eq('id', opportunityId)
      .single()

    if (opportunityError || !opportunity) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      )
    }

    if (action === 'save') {
      // Check if already saved
      const { data: existing } = await supabase
        .from('saved_opportunities')
        .select('id')
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityId)
        .single()

      if (existing) {
        // Update existing saved opportunity
        const { error: updateError } = await supabase
          .from('saved_opportunities')
          .update({
            notes: notes || null,
            tags: tags || [],
            is_pursuing: isPursuing || false,
            reminder_date: reminderDate || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)

        if (updateError) {
          console.error('Error updating saved opportunity:', updateError)
          return NextResponse.json(
            { error: 'Failed to update saved opportunity' },
            { status: 500 }
          )
        }
      } else {
        // Create new saved opportunity
        const { error: insertError } = await supabase
          .from('saved_opportunities')
          .insert({
            user_id: user.id,
            opportunity_id: opportunityId,
            notes: notes || null,
            tags: tags || [],
            is_pursuing: isPursuing || false,
            reminder_date: reminderDate || null
          })

        if (insertError) {
          console.error('Error saving opportunity:', insertError)
          return NextResponse.json(
            { error: 'Failed to save opportunity' },
            { status: 500 }
          )
        }
      }

      // Log the action
      await supabase.rpc('log_audit', {
        p_action: 'save_opportunity',
        p_entity_type: 'opportunities',
        p_entity_id: opportunityId,
        p_changes: { action: 'save', notes: !!notes, tags: tags?.length || 0 }
      })

      return NextResponse.json({ 
        success: true,
        message: 'Opportunity saved successfully'
      })

    } else if (action === 'unsave') {
      // Remove saved opportunity
      const { error: deleteError } = await supabase
        .from('saved_opportunities')
        .delete()
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityId)

      if (deleteError) {
        console.error('Error unsaving opportunity:', deleteError)
        return NextResponse.json(
          { error: 'Failed to unsave opportunity' },
          { status: 500 }
        )
      }

      // Log the action
      await supabase.rpc('log_audit', {
        p_action: 'unsave_opportunity',
        p_entity_type: 'opportunities',
        p_entity_id: opportunityId,
        p_changes: { action: 'unsave' }
      })

      return NextResponse.json({
        success: true,
        message: 'Opportunity unsaved successfully'
      })

    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Save opportunity error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}