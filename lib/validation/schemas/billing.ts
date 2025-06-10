import { z } from 'zod'
import { uuidSchema } from '../shared-schemas'

// Plan types based on your application's pricing structure
export const planTypeSchema = z.enum(['starter', 'professional', 'enterprise'])

// Checkout request schema
export const checkoutRequestSchema = z.object({
  planId: planTypeSchema
})

// Subscription status enum
export const subscriptionStatusSchema = z.enum([
  'active', 
  'canceled', 
  'incomplete', 
  'incomplete_expired', 
  'past_due', 
  'trialing', 
  'unpaid'
])

// Billing portal request schema
export const billingPortalRequestSchema = z.object({
  returnUrl: z.string().url().optional()
})

// Subscription update schema
export const updateSubscriptionSchema = z.object({
  planId: planTypeSchema.optional(),
  cancelAtPeriodEnd: z.boolean().optional()
})

// Payment method schema
export const paymentMethodSchema = z.object({
  type: z.enum(['card', 'bank_account']),
  last4: z.string().length(4),
  brand: z.string().optional(),
  expiryMonth: z.number().int().min(1).max(12).optional(),
  expiryYear: z.number().int().min(new Date().getFullYear()).optional()
})

// Invoice schema
export const invoiceSchema = z.object({
  id: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']),
  dueDate: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional()
})

// Subscription schema with computed properties
export const subscriptionSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  stripeCustomerId: z.string(),
  stripeSubscriptionId: z.string(),
  plan: planTypeSchema,
  status: subscriptionStatusSchema,
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  canceledAt: z.string().datetime().optional(),
  cancelAtPeriodEnd: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional()
}).transform((subscription) => ({
  ...subscription,
  isActive: () => subscription.status === 'active' || subscription.status === 'trialing',
  daysUntilRenewal: () => {
    if (subscription.status !== 'active' && subscription.status !== 'trialing') return null
    const now = new Date()
    const endDate = new Date(subscription.currentPeriodEnd)
    const diffTime = endDate.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  },
  isExpiringSoon: () => {
    const days = subscription.daysUntilRenewal?.()
    return days !== null && days <= 7
  }
}))

// Type exports
export type PlanType = z.infer<typeof planTypeSchema>
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>
export type BillingPortalRequest = z.infer<typeof billingPortalRequestSchema>
export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>
export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export type Invoice = z.infer<typeof invoiceSchema>
export type Subscription = z.infer<typeof subscriptionSchema>