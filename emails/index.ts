/**
 * Email Templates Index
 * Centralized exports for all email templates
 */

export { OpportunityDeadlineReminder } from './opportunity-deadline-reminder'
export { NewOpportunityMatch } from './new-opportunity-match'
export { WelcomeEmail } from './welcome'

// Email template types
export interface IEmailTemplateProps {
  // Common props that all templates should support
  companyName: string
  firstName?: string
}

// Email template registry for dynamic loading
export const EMAIL_TEMPLATES = {
  'opportunity-deadline-reminder': 'OpportunityDeadlineReminder',
  'new-opportunity-match': 'NewOpportunityMatch',
  'welcome': 'WelcomeEmail',
} as const

export type EmailTemplateType = keyof typeof EMAIL_TEMPLATES