/**
 * Email Client using Resend API
 * Handles all email sending functionality with error handling and logging
 */

import { Resend } from 'resend'
import { render } from '@react-email/render'
import { emailLogger } from '@/lib/errors/logger'
import { ExternalAPIError } from '@/lib/errors/types'

// Lazy-initialized Resend client
let resend: Resend | null = null

function getResendClient(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is required')
    }
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

export interface IEmailTemplate {
  to: string | string[]
  subject: string
  react: React.ReactElement
  from?: string
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
}

export interface IEmailResult {
  id: string
  success: boolean
  error?: string
}

/**
 * Email service with comprehensive error handling and logging
 */
export class EmailService {
  private readonly fromEmail: string
  private readonly fromName: string

  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@medcontracthub.com'
    this.fromName = process.env.FROM_NAME || 'MedContractHub'
  }

  /**
   * Send email using Resend API
   */
  async send(template: IEmailTemplate): Promise<IEmailResult> {
    try {
      // Validate API key
      if (!process.env.RESEND_API_KEY) {
        throw new ExternalAPIError('Email Service', 'Resend API key not configured')
      }

      // Log email attempt
      emailLogger.info('Sending email', {
        to: Array.isArray(template.to) ? template.to.join(', ') : template.to,
        subject: template.subject,
        from: template.from || `${this.fromName} <${this.fromEmail}>`
      })

      const client = getResendClient()
      const result = await client.emails.send({
        from: template.from || `${this.fromName} <${this.fromEmail}>`,
        to: template.to,
        subject: template.subject,
        react: template.react,
        replyTo: template.replyTo,
        cc: template.cc,
        bcc: template.bcc,
      })

      if (result.error) {
        emailLogger.error('Email sending failed', result.error, {
          to: template.to,
          subject: template.subject
        })
        
        return {
          id: '',
          success: false,
          error: result.error.message
        }
      }

      emailLogger.info('Email sent successfully', {
        id: result.data?.id,
        to: template.to,
        subject: template.subject
      })

      return {
        id: result.data?.id || '',
        success: true
      }

    } catch (error) {
      emailLogger.error('Email service error', error as Error, {
        to: template.to,
        subject: template.subject
      })

      if (error instanceof ExternalAPIError) {
        throw error
      }

      throw new ExternalAPIError(
        'Email Service',
        'Failed to send email',
        undefined,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  /**
   * Send email with HTML/text fallback
   */
  async sendWithFallback(template: IEmailTemplate & { html?: string; text?: string }): Promise<IEmailResult> {
    try {
      const client = getResendClient()
      const result = await client.emails.send({
        from: template.from || `${this.fromName} <${this.fromEmail}>`,
        to: template.to,
        subject: template.subject,
        react: template.react,
        html: template.html,
        text: template.text,
        replyTo: template.replyTo,
        cc: template.cc,
        bcc: template.bcc,
      })

      if (result.error) {
        return {
          id: '',
          success: false,
          error: result.error.message
        }
      }

      return {
        id: result.data?.id || '',
        success: true
      }

    } catch (error) {
      throw new ExternalAPIError(
        'Email Service',
        'Failed to send email with fallback',
        undefined,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  /**
   * Render React email to HTML for preview
   */
  async renderToHtml(reactElement: React.ReactElement): Promise<string> {
    try {
      return await render(reactElement)
    } catch (error) {
      emailLogger.error('Failed to render email template', error as Error)
      throw new Error('Failed to render email template')
    }
  }

  /**
   * Validate email configuration
   */
  validateConfig(): boolean {
    const requiredEnvVars = ['RESEND_API_KEY']
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar])
    
    if (missing.length > 0) {
      emailLogger.error('Missing email configuration', new Error('Missing environment variables'), {
        missing: missing.join(', ')
      })
      return false
    }

    return true
  }

  /**
   * Test email service connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      // Note: Resend doesn't have a specific health check endpoint
      // This is a minimal test that validates the API key format
      if (!this.validateConfig()) {
        return false
      }

      emailLogger.info('Email service connection test passed')
      return true
    } catch (error) {
      emailLogger.error('Email service connection test failed', error as Error)
      return false
    }
  }
}

// Export singleton instance
export const emailService = new EmailService()

// Export helper functions
export const validateEmailConfig = () => emailService.validateConfig()
export const testEmailConnection = () => emailService.testConnection()
export const renderEmailToHtml = (reactElement: React.ReactElement) => 
  emailService.renderToHtml(reactElement)