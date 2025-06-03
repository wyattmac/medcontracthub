/**
 * Email Job Processor
 * Handles email sending jobs from the queue
 */

import { Job } from 'bull'
import React from 'react'
import { IEmailJob } from '../index'
import { emailService } from '@/lib/email/client'
import { apiLogger } from '@/lib/errors/logger'
import { createServerClient } from '@/lib/supabase/server'

// Import email templates
import { OpportunityDeadlineReminder } from '@/emails/opportunity-deadline-reminder'
import { NewOpportunityMatch } from '@/emails/new-opportunity-match'
import { Welcome } from '@/emails/welcome'

const emailTemplates = {
  'opportunity-deadline-reminder': OpportunityDeadlineReminder,
  'new-opportunity-match': NewOpportunityMatch,
  'welcome': Welcome,
} as const

export async function processEmailJob(job: Job<IEmailJob>) {
  const { to, subject, template, data, userId } = job.data

  try {
    apiLogger.info('Processing email job', {
      jobId: job.id,
      to,
      template,
      userId
    })

    // Get template component
    const TemplateComponent = emailTemplates[template as keyof typeof emailTemplates]
    
    if (!TemplateComponent) {
      throw new Error(`Unknown email template: ${template}`)
    }

    // Create React element
    const emailElement = React.createElement(TemplateComponent as any, data)

    // Send email
    const result = await emailService.send({
      to,
      subject,
      react: emailElement
    })

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email')
    }

    // Log email sent
    try {
      const supabase = await createServerClient()
      await supabase
        .from('email_logs')
        .insert({
          user_id: userId,
          email_type: template,
          recipient: to,
          subject,
          status: 'sent',
          external_id: result.id,
          metadata: {
            job_id: job.id,
            template_data: data
          },
          sent_at: new Date().toISOString()
        })
    } catch (logError) {
      apiLogger.warn('Failed to log email', logError as Error)
    }

    apiLogger.info('Email sent successfully', {
      jobId: job.id,
      emailId: result.id,
      to,
      template
    })

    return {
      success: true,
      emailId: result.id,
      sentAt: new Date().toISOString()
    }

  } catch (error) {
    apiLogger.error('Email job failed', error as Error, {
      jobId: job.id,
      to,
      template,
      attemptsMade: job.attemptsMade
    })

    // Log failure
    try {
      const supabase = await createServerClient()
      await supabase
        .from('email_logs')
        .insert({
          user_id: userId,
          email_type: template,
          recipient: to,
          subject,
          status: 'failed',
          error_message: (error as Error).message,
          metadata: {
            job_id: job.id,
            attempt_number: job.attemptsMade + 1,
            template_data: data
          }
        })
    } catch (logError) {
      apiLogger.error('Failed to log email error', logError as Error)
    }

    throw error
  }
}

/**
 * Process bulk email jobs
 */
export async function processBulkEmailJob(job: Job<{
  template: string
  recipients: Array<{
    to: string
    data: Record<string, any>
    userId?: string
  }>
  subject: string
}>) {
  const { template, recipients, subject } = job.data
  const results = []
  let processed = 0

  for (const recipient of recipients) {
    try {
      // Update progress
      await job.progress(Math.floor((processed / recipients.length) * 100))

      // Send individual email
      await processEmailJob({
        ...job,
        data: {
          to: recipient.to,
          subject,
          template,
          data: recipient.data,
          userId: recipient.userId
        }
      } as Job<IEmailJob>)

      results.push({
        to: recipient.to,
        success: true
      })

    } catch (error) {
      results.push({
        to: recipient.to,
        success: false,
        error: (error as Error).message
      })
    }

    processed++
  }

  const successCount = results.filter(r => r.success).length
  
  apiLogger.info('Bulk email job completed', {
    jobId: job.id,
    totalRecipients: recipients.length,
    successCount,
    failedCount: recipients.length - successCount
  })

  return {
    processed: recipients.length,
    successful: successCount,
    failed: recipients.length - successCount,
    results
  }
}