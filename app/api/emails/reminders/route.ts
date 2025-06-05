/**
 * Email Reminders API Route
 * Handles deadline reminders and scheduled email notifications
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler'
import { emailService } from '@/lib/email/client'
import { NotFoundError, ValidationError } from '@/lib/errors/types'
import { emailLogger } from '@/lib/errors/logger'
import { format, parseISO, differenceInDays, differenceInHours } from 'date-fns'
import React from 'react'
import { OpportunityDeadlineReminder } from '@/emails'

const reminderRequestSchema = z.object({
  opportunityId: z.string().uuid(),
  reminderType: z.enum(['24_hours', '3_days', '7_days', 'custom']),
  customDays: z.number().optional(),
})

const bulkReminderSchema = z.object({
  reminderType: z.enum(['24_hours', '3_days', '7_days']),
  dryRun: z.boolean().default(false),
})

export const POST = routeHandler.POST(
  async ({ request, user, supabase }) => {
    const body = await request.json()
    const { opportunityId, reminderType } = reminderRequestSchema.parse(body)

    // Get the opportunity details
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .select(`
        id,
        title,
        solicitation_number,
        response_deadline,
        estimated_value,
        description,
        saved_opportunities!inner(
          id,
          user_id,
          notes,
          tags
        )
      `)
      .eq('id', opportunityId)
      .eq('saved_opportunities.user_id', user.id)
      .single()

    if (opportunityError || !opportunity) {
      throw new NotFoundError('Opportunity not found or not saved by user')
    }

    if (!opportunity.response_deadline) {
      throw new ValidationError('Opportunity has no deadline set')
    }

    // Calculate days remaining
    const deadline = parseISO(opportunity.response_deadline)
    const now = new Date()
    const daysRemaining = differenceInDays(deadline, now)
    const hoursRemaining = differenceInHours(deadline, now)

    // Check if reminder is still relevant
    if (daysRemaining < 0) {
      throw new ValidationError('Opportunity deadline has already passed')
    }

    // Get user company information
    const { data: company } = await supabase
      .from('companies')
      .select('name, primary_contact_name')
      .eq('id', user.company_id)
      .single()

    const companyName = company?.name || 'Your Company'

    // Create the email template
    const emailTemplate = React.createElement(OpportunityDeadlineReminder, {
      opportunityTitle: opportunity.title || 'Untitled Opportunity',
      solicitationNumber: opportunity.solicitation_number || 'N/A',
      deadlineDate: format(deadline, 'EEEE, MMMM d, yyyy'),
      deadlineTime: format(deadline, 'h:mm a zzz'),
      daysRemaining,
      opportunityUrl: `${process.env.NEXT_PUBLIC_APP_URL}/opportunities/${opportunity.id}`,
      companyName,
      estimatedValue: opportunity.estimated_value,
      description: opportunity.description,
    })

    // Generate subject with urgency indicator
    const urgency = daysRemaining <= 1 ? '🚨 URGENT: ' : 
                   daysRemaining <= 3 ? '⚠️ ' : ''
    const subject = `${urgency}Deadline Reminder: ${opportunity.title}`

    // Send the email
    const result = await emailService.send({
      to: user.email,
      subject,
      react: emailTemplate,
    })

    if (!result.success) {
      emailLogger.error('Failed to send deadline reminder', new Error(result.error || 'Unknown error'), {
        opportunityId,
        userId: user.id,
        reminderType
      })
      
      throw new Error('Failed to send reminder email')
    }

    // Log the reminder in database
    await supabase
      .from('email_logs')
      .insert({
        user_id: user.id,
        email_type: 'opportunity-deadline-reminder',
        recipient: user.email,
        subject,
        status: 'sent',
        external_id: result.id,
        metadata: {
          opportunity_id: opportunityId,
          reminder_type: reminderType,
          days_remaining: daysRemaining,
          hours_remaining: hoursRemaining
        },
        sent_at: new Date().toISOString(),
      })

    emailLogger.info('Deadline reminder sent', {
      opportunityId,
      userId: user.id,
      reminderType,
      daysRemaining,
      emailId: result.id
    })

    return NextResponse.json({
      success: true,
      emailId: result.id,
      daysRemaining,
      hoursRemaining,
      message: 'Deadline reminder sent successfully'
    })
  },
  { requireAuth: true }
)

// Bulk reminder endpoint for system cron jobs
export const PUT = routeHandler.PUT(
  async ({ request, supabase }) => {
    const body = await request.json()
    const { reminderType, dryRun } = bulkReminderSchema.parse(body)

    // Determine the day threshold based on reminder type
    const dayThresholds = {
      '24_hours': 1,
      '3_days': 3,
      '7_days': 7,
    }

    const targetDays = dayThresholds[reminderType]
    
    // Calculate date range for opportunities that need reminders
    const now = new Date()
    const startDate = new Date()
    startDate.setDate(now.getDate() + targetDays - 0.5) // 0.5 day buffer
    const endDate = new Date()
    endDate.setDate(now.getDate() + targetDays + 0.5)

    // Find opportunities that need reminders
    const { data: opportunities, error } = await supabase
      .from('opportunities')
      .select(`
        id,
        title,
        solicitation_number,
        response_deadline,
        estimated_value,
        description,
        saved_opportunities(
          user_id,
          users(
            email,
            company_id,
            companies(
              name,
              primary_contact_name
            )
          )
        )
      `)
      .gte('response_deadline', startDate.toISOString())
      .lte('response_deadline', endDate.toISOString())
      .not('saved_opportunities', 'is', null)

    if (error) {
      emailLogger.error('Failed to fetch opportunities for bulk reminders', error)
      throw new Error('Failed to fetch opportunities for reminders')
    }

    const emailsSent: string[] = []
    const errors: string[] = []

    if (dryRun) {
      // Return what would be sent without actually sending
      return NextResponse.json({
        dryRun: true,
        reminderType,
        opportunitiesFound: opportunities.length,
        totalEmails: opportunities.reduce((sum: number, opp: any) => sum + opp.saved_opportunities.length, 0),
        opportunities: opportunities.map((opp: any) => ({
          id: opp.id,
          title: opp.title,
          deadline: opp.response_deadline,
          usersToNotify: opp.saved_opportunities.length
        }))
      })
    }

    // Send reminders for each saved opportunity
    for (const opportunity of opportunities) {
      for (const savedOpp of opportunity.saved_opportunities) {
        try {
          const user = savedOpp.users
          const company = user?.companies
          
          if (!user?.email) {
            errors.push(`No email for user ${savedOpp.user_id}`)
            continue
          }

          const deadline = parseISO(opportunity.response_deadline!)
          const daysRemaining = differenceInDays(deadline, now)

          // Create email template
          const emailTemplate = React.createElement(OpportunityDeadlineReminder, {
            opportunityTitle: opportunity.title || 'Untitled Opportunity',
            solicitationNumber: opportunity.solicitation_number || 'N/A',
            deadlineDate: format(deadline, 'EEEE, MMMM d, yyyy'),
            deadlineTime: format(deadline, 'h:mm a zzz'),
            daysRemaining,
            opportunityUrl: `${process.env.NEXT_PUBLIC_APP_URL}/opportunities/${opportunity.id}`,
            companyName: company?.name || 'Your Company',
            estimatedValue: opportunity.estimated_value,
            description: opportunity.description,
          })

          const urgency = daysRemaining <= 1 ? '🚨 URGENT: ' : 
                         daysRemaining <= 3 ? '⚠️ ' : ''
          const subject = `${urgency}Deadline Reminder: ${opportunity.title}`

          // Send email
          const result = await emailService.send({
            to: user.email,
            subject,
            react: emailTemplate,
          })

          if (result.success) {
            emailsSent.push(result.id!)
            
            // Log in database
            await supabase
              .from('email_logs')
              .insert({
                user_id: savedOpp.user_id,
                email_type: 'opportunity-deadline-reminder',
                recipient: user.email,
                subject,
                status: 'sent',
                external_id: result.id,
                metadata: {
                  opportunity_id: opportunity.id,
                  reminder_type: reminderType,
                  days_remaining: daysRemaining,
                  bulk_send: true
                },
                sent_at: new Date().toISOString(),
              })
          } else {
            errors.push(`Failed to send to ${user.email}: ${result.error}`)
          }

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          errors.push(`Error processing user ${savedOpp.user_id}: ${error}`)
        }
      }
    }

    emailLogger.info('Bulk reminder process completed', {
      reminderType,
      opportunitiesProcessed: opportunities.length,
      emailsSent: emailsSent.length,
      errors: errors.length
    })

    return NextResponse.json({
      success: true,
      reminderType,
      opportunitiesProcessed: opportunities.length,
      emailsSent: emailsSent.length,
      errors: errors.length,
      errorDetails: errors,
      emailIds: emailsSent
    })
  },
  {
    requireAuth: false, // This endpoint is called by cron jobs
    validateQuery: z.object({
      apiKey: z.string().optional()
    })
  }
)