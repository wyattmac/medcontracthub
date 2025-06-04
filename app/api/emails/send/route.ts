/**
 * Email Send API Route
 * Handles sending various types of emails with validation and error handling
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler'
import { emailService } from '@/lib/email/client'
import { ValidationError, ExternalAPIError } from '@/lib/errors/types'
import { emailLogger } from '@/lib/errors/logger'
import { withUsageCheck } from '@/lib/usage/tracker'
import React from 'react'

// Import email templates
import { OpportunityDeadlineReminder, NewOpportunityMatch, WelcomeEmail } from '@/emails'

// Validation schemas for different email types
const baseEmailSchema = z.object({
  type: z.enum(['opportunity-deadline-reminder', 'new-opportunity-match', 'welcome']),
  to: z.string().email().or(z.array(z.string().email())),
  companyName: z.string().min(1),
  firstName: z.string().optional(),
})

const opportunityReminderSchema = baseEmailSchema.extend({
  type: z.literal('opportunity-deadline-reminder'),
  opportunityTitle: z.string().min(1),
  solicitationNumber: z.string().min(1),
  deadlineDate: z.string(),
  deadlineTime: z.string(),
  daysRemaining: z.number(),
  opportunityUrl: z.string().url(),
  estimatedValue: z.string().optional(),
  description: z.string().optional(),
})

const opportunityMatchSchema = baseEmailSchema.extend({
  type: z.literal('new-opportunity-match'),
  opportunities: z.array(z.object({
    id: z.string(),
    title: z.string(),
    solicitationNumber: z.string(),
    deadline: z.string(),
    estimatedValue: z.string().optional(),
    agency: z.string(),
    matchReason: z.string(),
    confidence: z.number().min(0).max(100),
  })),
  totalMatches: z.number(),
  timeframe: z.string(),
})

const welcomeEmailSchema = baseEmailSchema.extend({
  type: z.literal('welcome'),
  dashboardUrl: z.string().url(),
})

const emailRequestSchema = z.discriminatedUnion('type', [
  opportunityReminderSchema,
  opportunityMatchSchema,
  welcomeEmailSchema,
])

export const POST = routeHandler.POST(
  async ({ request, user, supabase }) => {
    let body: any
    
    try {
      body = await request.json()
      const emailData = emailRequestSchema.parse(body)

      // Validate email service configuration
      if (!emailService.validateConfig()) {
        throw new ExternalAPIError(
          'Email Service',
          'Email service not properly configured'
        )
      }

      // Generate the appropriate email template
      let emailTemplate: React.ReactElement

      switch (emailData.type) {
        case 'opportunity-deadline-reminder':
          emailTemplate = React.createElement(OpportunityDeadlineReminder, {
            opportunityTitle: emailData.opportunityTitle,
            solicitationNumber: emailData.solicitationNumber,
            deadlineDate: emailData.deadlineDate,
            deadlineTime: emailData.deadlineTime,
            daysRemaining: emailData.daysRemaining,
            opportunityUrl: emailData.opportunityUrl,
            companyName: emailData.companyName,
            estimatedValue: emailData.estimatedValue,
            description: emailData.description,
          })
          break

        case 'new-opportunity-match':
          emailTemplate = React.createElement(NewOpportunityMatch, {
            companyName: emailData.companyName,
            opportunities: emailData.opportunities,
            totalMatches: emailData.totalMatches,
            timeframe: emailData.timeframe,
          })
          break

        case 'welcome':
          emailTemplate = React.createElement(WelcomeEmail, {
            companyName: emailData.companyName,
            firstName: emailData.firstName,
            dashboardUrl: emailData.dashboardUrl,
          })
          break

        default:
          throw new ValidationError('Invalid email type')
      }

      // Generate email subject based on type
      const subject = generateEmailSubject(emailData)

      // Send the email with usage tracking
      const result = await withUsageCheck(
        user.id,
        'email_sent',
        Array.isArray(emailData.to) ? emailData.to.length : 1,
        async () => {
          return await emailService.send({
            to: emailData.to,
            subject,
            react: emailTemplate,
          })
        }
      )

      if (!result.success) {
        throw new ExternalAPIError(
          'Email Service',
          result.error || 'Failed to send email'
        )
      }

      // Log successful email sending
      emailLogger.info('Email sent successfully', {
        type: emailData.type,
        to: emailData.to,
        emailId: result.id,
        userId: user.id,
      })

      // Track email in database (optional)
      try {
        await supabase
          .from('email_logs')
          .insert({
            user_id: user.id,
            email_type: emailData.type,
            recipient: Array.isArray(emailData.to) ? emailData.to.join(',') : emailData.to,
            subject,
            status: 'sent',
            external_id: result.id,
            sent_at: new Date().toISOString(),
          })
      } catch (dbError) {
        // Log but don't fail the request if database logging fails
        emailLogger.warn('Failed to log email in database', dbError as Error)
      }

      return NextResponse.json({
        success: true,
        emailId: result.id,
        message: 'Email sent successfully'
      })

    } catch (error) {
      emailLogger.error('Email send API error', error as Error, {
        userId: user.id,
        requestBody: body
      })

      if (error instanceof ValidationError || error instanceof ExternalAPIError) {
        throw error
      }

      throw new ExternalAPIError(
        'Email Service',
        'Internal email service error',
        undefined,
        error instanceof Error ? error.message : String(error)
      )
    }
  },
  {
    requireAuth: true,
    validateQuery: z.object({
      // Optional query parameters for testing
      preview: z.string().optional(),
    }),
    rateLimit: 'api',
    sanitization: {
      body: {
        // Sanitize all text content in emails
        companyName: 'text',
        firstName: 'text',
        opportunityTitle: 'text',
        solicitationNumber: 'text',
        description: 'basic', // Allow basic formatting
        estimatedValue: 'text'
      }
    }
  }
)

/**
 * Generate email subject based on email type and data
 */
function generateEmailSubject(emailData: z.infer<typeof emailRequestSchema>): string {
  switch (emailData.type) {
    case 'opportunity-deadline-reminder':
      const urgency = emailData.daysRemaining <= 1 ? '🚨 URGENT: ' : 
                     emailData.daysRemaining <= 3 ? '⚠️ ' : ''
      return `${urgency}Deadline Reminder: ${emailData.opportunityTitle}`

    case 'new-opportunity-match':
      const count = emailData.totalMatches
      return `🎯 ${count} New Federal Contract ${count === 1 ? 'Opportunity' : 'Opportunities'} Found`

    case 'welcome':
      return `Welcome to MedContractHub, ${emailData.companyName}!`

    default:
      return 'MedContractHub Notification'
  }
}

// GET endpoint for email preview (development only)
export const GET = routeHandler.GET(
  async ({ request, user }) => {
    if (process.env.NODE_ENV !== 'development') {
      throw new ValidationError('Email preview only available in development')
    }

    const url = new URL(request.url)
    const type = url.searchParams.get('type') as 'welcome' | 'opportunity-deadline-reminder' | 'new-opportunity-match'

    if (!type) {
      throw new ValidationError('Email type required for preview')
    }

    let previewData: any

    switch (type) {
      case 'welcome':
        previewData = {
          companyName: 'Acme Medical Supplies',
          firstName: 'John',
          dashboardUrl: 'http://localhost:3000/dashboard'
        }
        break

      case 'opportunity-deadline-reminder':
        previewData = {
          opportunityTitle: 'Medical Equipment for VA Hospitals',
          solicitationNumber: 'VA-123-2024',
          deadlineDate: 'December 15, 2024',
          deadlineTime: '3:00 PM EST',
          daysRemaining: 3,
          opportunityUrl: 'http://localhost:3000/opportunities/test-123',
          companyName: 'Acme Medical Supplies',
          estimatedValue: '$500,000 - $1,000,000',
          description: 'The Department of Veterans Affairs seeks to procure advanced medical equipment for multiple VA hospital facilities across the southeastern United States.'
        }
        break

      case 'new-opportunity-match':
        previewData = {
          companyName: 'Acme Medical Supplies',
          opportunities: [
            {
              id: 'test-1',
              title: 'Medical Devices for Military Hospitals',
              solicitationNumber: 'DOD-456-2024',
              deadline: 'January 20, 2025',
              estimatedValue: '$2,000,000',
              agency: 'Department of Defense',
              matchReason: 'Matches your NAICS 334510 (Medical Equipment Manufacturing)',
              confidence: 92
            },
            {
              id: 'test-2', 
              title: 'Surgical Supplies for Federal Facilities',
              solicitationNumber: 'HHS-789-2024',
              deadline: 'February 5, 2025',
              agency: 'Health and Human Services',
              matchReason: 'Matches your NAICS 325414 (Biological Product Manufacturing)',
              confidence: 87
            }
          ],
          totalMatches: 5,
          timeframe: 'in the last 24 hours'
        }
        break

      default:
        throw new ValidationError('Invalid email type for preview')
    }

    // Return HTML preview
    let emailTemplate: React.ReactElement

    switch (type) {
      case 'welcome':
        emailTemplate = React.createElement(WelcomeEmail, previewData)
        break
      case 'opportunity-deadline-reminder':
        emailTemplate = React.createElement(OpportunityDeadlineReminder, previewData)
        break
      case 'new-opportunity-match':
        emailTemplate = React.createElement(NewOpportunityMatch, previewData)
        break
    }

    const html = await emailService.renderToHtml(emailTemplate)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  },
  { requireAuth: true }
)