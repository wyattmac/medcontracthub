/**
 * Optimized Bulk Reminder Endpoint
 * Fixes N+1 query issues by batching email sends
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parseISO, differenceInDays, differenceInHours, format } from 'date-fns'
import React from 'react'
import { routeHandler } from '@/lib/api/route-handler'
import { emailService } from '@/lib/email/client'
import { OpportunityDeadlineReminder } from '@/emails/opportunity-deadline-reminder'
import { emailLogger } from '@/lib/errors/logger'

const bulkReminderSchema = z.object({
  reminderType: z.enum(['24_hours', '3_days', '7_days']),
  dryRun: z.boolean().default(false),
})

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

    // Find opportunities that need reminders with optimized query
    const { data: reminderData, error } = await supabase
      .rpc('get_reminder_opportunities', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      })

    if (error) {
      emailLogger.error('Failed to fetch opportunities for bulk reminders', error)
      throw new Error('Failed to fetch opportunities for reminders')
    }

    if (dryRun) {
      // Return what would be sent without actually sending
      const groupedByOpportunity = reminderData.reduce((acc: any, item: any) => {
        if (!acc[item.opportunity_id]) {
          acc[item.opportunity_id] = {
            id: item.opportunity_id,
            title: item.opportunity_title,
            deadline: item.response_deadline,
            usersToNotify: 0
          }
        }
        acc[item.opportunity_id].usersToNotify++
        return acc
      }, {})

      return NextResponse.json({
        dryRun: true,
        reminderType,
        opportunitiesFound: Object.keys(groupedByOpportunity).length,
        totalEmails: reminderData.length,
        opportunities: Object.values(groupedByOpportunity)
      })
    }

    // Batch email sending for performance
    const emailBatches = []
    const BATCH_SIZE = 10

    for (let i = 0; i < reminderData.length; i += BATCH_SIZE) {
      const batch = reminderData.slice(i, i + BATCH_SIZE)
      emailBatches.push(batch)
    }

    const emailsSent: string[] = []
    const errors: string[] = []

    // Process batches in parallel with controlled concurrency
    const MAX_CONCURRENT_BATCHES = 3
    
    for (let i = 0; i < emailBatches.length; i += MAX_CONCURRENT_BATCHES) {
      const currentBatches = emailBatches.slice(i, i + MAX_CONCURRENT_BATCHES)
      
      await Promise.all(
        currentBatches.map(async (batch) => {
          const batchPromises = batch.map(async (reminder: any) => {
            try {
              const deadline = parseISO(reminder.response_deadline)
              const daysRemaining = differenceInDays(deadline, now)
              const hoursRemaining = differenceInHours(deadline, now)

              // Create email template
              const emailTemplate = React.createElement(OpportunityDeadlineReminder, {
                opportunityTitle: reminder.opportunity_title || 'Untitled Opportunity',
                solicitationNumber: reminder.solicitation_number || 'N/A',
                deadlineDate: format(deadline, 'EEEE, MMMM d, yyyy'),
                deadlineTime: format(deadline, 'h:mm a zzz'),
                daysRemaining,
                opportunityUrl: `${process.env.NEXT_PUBLIC_APP_URL}/opportunities/${reminder.opportunity_id}`,
                companyName: reminder.company_name || reminder.user_name || reminder.user_email.split('@')[0],
                estimatedValue: reminder.estimated_value,
              })

              const subject = getSubjectForReminder(reminderType, reminder.opportunity_title, hoursRemaining)

              // Send the email
              const result = await emailService.send({
                to: reminder.user_email,
                subject,
                react: emailTemplate,
              })

              if (result.success) {
                emailsSent.push(reminder.user_email)
                
                // Log success in batch (will be done after all emails sent)
                return {
                  user_id: reminder.user_id,
                  opportunity_id: reminder.opportunity_id,
                  email_id: result.id,
                  reminder_type: reminderType
                }
              } else {
                errors.push(`Failed to send to ${reminder.user_email}: ${result.error}`)
                return null
              }
            } catch (error) {
              errors.push(`Error sending to ${reminder.user_email}: ${error}`)
              return null
            }
          })

          const results = await Promise.all(batchPromises)
          
          // Batch insert email logs for successful sends
          const successfulLogs = results.filter(Boolean)
          if (successfulLogs.length > 0) {
            await supabase
              .from('email_logs')
              .insert(successfulLogs.map((log: any) => ({
                user_id: log.user_id,
                email_type: 'opportunity-deadline-reminder',
                recipient: emailsSent.find(email => email.includes(log.user_id)),
                subject: getSubjectForReminder(reminderType, '', 0),
                status: 'sent',
                external_id: log.email_id,
                metadata: {
                  opportunity_id: log.opportunity_id,
                  reminder_type: log.reminder_type,
                  bulk_send: true
                },
                sent_at: new Date().toISOString(),
              })))
          }
        })
      )
    }

    emailLogger.info('Bulk reminders completed', {
      reminderType,
      totalSent: emailsSent.length,
      totalErrors: errors.length,
      errors: errors.slice(0, 10) // Log first 10 errors
    })

    return NextResponse.json({
      success: true,
      reminderType,
      sent: emailsSent.length,
      failed: errors.length,
      errors: errors.slice(0, 10), // Return first 10 errors
      message: `Sent ${emailsSent.length} reminder emails`
    })
  },
  { 
    requireAuth: false, // System endpoint for cron jobs
    rateLimit: {
      interval: 60 * 60 * 1000, // 1 hour
      uniqueTokenPerInterval: 10 // 10 bulk sends per hour
    }
  }
)

function getSubjectForReminder(
  reminderType: string,
  opportunityTitle: string,
  hoursRemaining: number
): string {
  const truncatedTitle = opportunityTitle.length > 50 
    ? opportunityTitle.substring(0, 47) + '...' 
    : opportunityTitle

  switch (reminderType) {
    case '24_hours':
      return `⏰ Urgent: ${truncatedTitle} - Deadline in ${hoursRemaining} hours`
    case '3_days':
      return `📅 Reminder: ${truncatedTitle} - 3 days left to submit`
    case '7_days':
      return `📌 Upcoming: ${truncatedTitle} - 7 days until deadline`
    default:
      return `Deadline Reminder: ${truncatedTitle}`
  }
}

// Also need to create the RPC function in Supabase:
/*
CREATE OR REPLACE FUNCTION get_reminder_opportunities(
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP
)
RETURNS TABLE (
  opportunity_id UUID,
  opportunity_title TEXT,
  solicitation_number TEXT,
  response_deadline TIMESTAMP,
  estimated_value NUMERIC,
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  company_id UUID,
  company_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id AS opportunity_id,
    o.title AS opportunity_title,
    o.solicitation_number,
    o.response_deadline,
    o.estimated_value_max AS estimated_value,
    u.id AS user_id,
    u.email AS user_email,
    p.full_name AS user_name,
    c.id AS company_id,
    c.name AS company_name
  FROM opportunities o
  INNER JOIN saved_opportunities so ON so.opportunity_id = o.id
  INNER JOIN auth.users u ON u.id = so.user_id
  LEFT JOIN profiles p ON p.id = u.id
  LEFT JOIN companies c ON c.id = p.company_id
  WHERE o.response_deadline >= p_start_date
    AND o.response_deadline <= p_end_date
    AND o.status = 'active'
  ORDER BY o.response_deadline, o.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/