/**
 * Email Templates Index
 * Centralized exports for all email templates
 */

export { OpportunityDeadlineReminder } from './opportunity-deadline-reminder'
export { NewOpportunityMatch } from './new-opportunity-match'
export { WelcomeEmail } from './welcome'
export { SubscriptionCreated } from './subscription-created'
export { SubscriptionUpdated } from './subscription-updated'
export { SubscriptionCanceled } from './subscription-canceled'
export { PaymentFailed } from './payment-failed'

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
  'subscription-created': 'SubscriptionCreated',
  'subscription-updated': 'SubscriptionUpdated',
  'subscription-canceled': 'SubscriptionCanceled',
  'payment-failed': 'PaymentFailed',
} as const

export type EmailTemplateType = keyof typeof EMAIL_TEMPLATES