/**
 * API Route: Save/unsave opportunities
 * POST /api/opportunities/save
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler'
import { 
  NotFoundError,
  ValidationError,
  DatabaseError
} from '@/lib/errors/types'

// Request body validation schema
const saveOpportunitySchema = z.object({
  opportunityId: z.string().min(1, 'Opportunity ID is required'),
  action: z.enum(['save', 'unsave'], {
    errorMap: () => ({ message: 'Invalid action. Must be "save" or "unsave"' })
  }),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  isPursuing: z.boolean().optional().default(false),
  reminderDate: z.string().datetime().nullable().optional()
})

export const POST = routeHandler.POST(
  async ({ user, supabase, sanitizedBody }) => {
    // Parse and validate request body
    const { 
      opportunityId, 
      action, 
      notes = null, 
      tags = [], 
      isPursuing = false, 
      reminderDate = null 
    } = sanitizedBody

    // Verify opportunity exists
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .select('id')
      .eq('id', opportunityId)
      .single()

    if (opportunityError || !opportunity) {
      throw new NotFoundError('Opportunity')
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
            notes,
            tags,
            is_pursuing: isPursuing,
            reminder_date: reminderDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)

        if (updateError) {
          throw new DatabaseError('Failed to update saved opportunity', updateError)
        }
      } else {
        // Create new saved opportunity
        const { error: insertError } = await supabase
          .from('saved_opportunities')
          .insert({
            user_id: user.id,
            opportunity_id: opportunityId,
            notes,
            tags,
            is_pursuing: isPursuing,
            reminder_date: reminderDate
          })

        if (insertError) {
          throw new DatabaseError('Failed to save opportunity', insertError)
        }
      }

      // Log the action
      await supabase.rpc('log_audit', {
        p_action: 'save_opportunity',
        p_entity_type: 'opportunities',
        p_entity_id: opportunityId,
        p_changes: { action: 'save', notes: !!notes, tags: tags.length }
      })

      return NextResponse.json({ 
        success: true,
        message: 'Opportunity saved successfully'
      })

    } else {
      // action === 'unsave'
      // Remove saved opportunity
      const { error: deleteError } = await supabase
        .from('saved_opportunities')
        .delete()
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityId)

      if (deleteError) {
        throw new DatabaseError('Failed to unsave opportunity', deleteError)
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
    }
  },
  {
    requireAuth: true,
    validateBody: saveOpportunitySchema,
    rateLimit: 'api',
    sanitization: {
      body: {
        notes: 'rich',
        tags: 'basic'
      }
    }
  }
)