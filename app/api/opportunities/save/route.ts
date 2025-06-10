/**
 * API Route: Save/unsave opportunities
 * POST /api/opportunities/save
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'
import { 
  NotFoundError,
  DatabaseError
} from '@/lib/errors/types'
import { uuidSchema, dateSchema } from '@/lib/validation/shared-schemas'

// Request body validation schema
const saveOpportunitySchema = z.object({
  opportunityId: uuidSchema,
  action: z.enum(['save', 'unsave'], {
    errorMap: () => ({ message: 'Invalid action. Must be "save" or "unsave"' })
  }),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').nullable().optional(),
  tags: z.array(z.string().max(50, 'Tag must be less than 50 characters')).max(20, 'Maximum 20 tags allowed').optional().default([]),
  isPursuing: z.boolean().optional().default(false),
  reminderDate: dateSchema.nullable().optional()
}).refine((data) => {
  // If setting a reminder, it must be in the future
  if (data.reminderDate && data.action === 'save') {
    return new Date(data.reminderDate) > new Date()
  }
  return true
}, {
  message: 'Reminder date must be in the future',
  path: ['reminderDate']
})

export const POST = enhancedRouteHandler.POST(
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

      // Log the action (if audit function exists)
      try {
        await supabase.rpc('log_audit', {
          p_action: 'save_opportunity',
          p_entity_type: 'opportunities',
          p_entity_id: opportunityId,
          p_changes: { action: 'save', notes: !!notes, tags: tags.length }
        })
      } catch (auditError) {
        // Continue if audit logging fails - it's not critical
        console.warn('Audit logging failed:', auditError)
      }

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

      // Log the action (if audit function exists)
      try {
        await supabase.rpc('log_audit', {
          p_action: 'unsave_opportunity',
          p_entity_type: 'opportunities',
          p_entity_id: opportunityId,
          p_changes: { action: 'unsave' }
        })
      } catch (auditError) {
        // Continue if audit logging fails - it's not critical
        console.warn('Audit logging failed:', auditError)
      }

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