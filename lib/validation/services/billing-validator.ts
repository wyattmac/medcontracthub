/**
 * Billing Validator Service
 * Provides comprehensive validation for billing and subscription data
 * 
 * Uses Context7-based Zod schemas for type safety
 * Reference: /zod/zod - v3 schema validation
 */

import { z } from 'zod'
import { subscriptionBusinessSchema } from '../business-rules'
import { ValidationError, UserFriendlyError } from '@/lib/errors/types'
import { apiLogger } from '@/lib/errors/logger'
import { emailSchema, currencySchema } from '../shared-schemas'
import { 
  checkoutRequestSchema,
  billingPortalRequestSchema,
  updateSubscriptionSchema,
  planTypeSchema,
  type CheckoutRequest,
  type BillingPortalRequest,
  type UpdateSubscription
} from '../schemas/billing'
import { formatZodError } from '../error-formatter'
export class BillingValidator {
  static subscriptionSchema = subscriptionBusinessSchema

  /**
   * Validate subscription data with business rules
   */
  static async validateSubscriptionWithBusinessRules(data: unknown): Promise<z.infer<typeof subscriptionBusinessSchema>> {
    try {
      // First, perform schema validation
      const validated = this.subscriptionSchema.parse(data)
      
      // Additional business rule validations
      
      // Log subscription changes for audit
      apiLogger.info('Subscription validation', {
        planId: validated.planId,
        billingCycle: validated.billingCycle,
        hasPaymentMethod: !!validated.paymentMethodId
      })
      
      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Subscription validation failed', error.errors)
      }
      throw error
    }
  }

  /**
   * Validate checkout request using comprehensive schema
   */
  static validateCheckout(data: unknown): CheckoutRequest {
    try {
      return checkoutRequestSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new UserFriendlyError(
          'Invalid checkout request',
          formatZodError(error),
          'VALIDATION_ERROR'
        )
      }
      throw error
    }
  }

  /**
   * Validate checkout session data (legacy method - kept for compatibility)
   */
  static validateCheckoutSession(data: any): void {
    const checkoutSchema = z.object({
      planId: z.enum(['starter', 'pro', 'enterprise']),
      billingCycle: z.enum(['monthly', 'annual']),
      email: emailSchema,
      successUrl: z.string().url(),
      cancelUrl: z.string().url()
    })
    
    try {
      checkoutSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid checkout data', error.errors)
      }
      throw error
    }
  }

  /**
   * Validate billing portal request
   */
  static validatePortalRequest(data: unknown): BillingPortalRequest {
    try {
      return billingPortalRequestSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new UserFriendlyError(
          'Invalid portal request',
          formatZodError(error),
          'VALIDATION_ERROR'
        )
      }
      throw error
    }
  }

  /**
   * Validate subscription update
   */
  static validateUpdate(data: unknown): UpdateSubscription {
    try {
      return updateSubscriptionSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new UserFriendlyError(
          'Invalid subscription update',
          formatZodError(error),
          'VALIDATION_ERROR'
        )
      }
      throw error
    }
  }

  /**
   * Validate webhook event from Stripe
   */
  static validateWebhookEvent(event: any): void {
    if (!event || !event.type || !event.data || !event.data.object) {
      throw new ValidationError('Invalid webhook event structure')
    }
    
    // Validate specific event types we handle
    const supportedEvents = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'checkout.session.completed'
    ]
    
    if (!supportedEvents.includes(event.type)) {
      apiLogger.info('Unsupported webhook event type', { type: event.type })
    }
  }

  /**
   * Validate usage tracking data
   */
  static validateUsageData(data: any): void {
    const usageSchema = z.object({
      userId: z.string().uuid(),
      feature: z.enum(['ai_analysis', 'ocr_processing', 'bulk_export', 'api_access']),
      quantity: z.number().int().positive(),
      timestamp: z.string().datetime(),
      metadata: z.record(z.string(), z.any()).optional()
    })
    
    try {
      usageSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid usage data', error.errors)
      }
      throw error
    }
  }

  /**
   * Validate plan limits
   */
  static validatePlanLimits(
    plan: string,
    feature: string,
    currentUsage: number,
    requestedUsage: number
  ): { allowed: boolean; limit: number; remaining: number } {
    // Define plan limits
    const planLimits: Record<string, Record<string, number>> = {
      starter: {
        opportunities_per_month: 100,
        saved_opportunities: 50,
        ai_analyses_per_month: 10,
        ocr_pages_per_month: 50,
        proposals_active: 5
      },
      pro: {
        opportunities_per_month: 1000,
        saved_opportunities: 500,
        ai_analyses_per_month: 100,
        ocr_pages_per_month: 500,
        proposals_active: 50
      },
      enterprise: {
        opportunities_per_month: -1, // Unlimited
        saved_opportunities: -1,
        ai_analyses_per_month: -1,
        ocr_pages_per_month: -1,
        proposals_active: -1
      }
    }
    
    const limits = planLimits[plan]
    if (!limits) {
      throw new ValidationError(`Invalid plan: ${plan}`)
    }
    
    const limit = limits[feature]
    if (limit === undefined) {
      throw new ValidationError(`Invalid feature: ${feature}`)
    }
    
    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit: -1, remaining: -1 }
    }
    
    const totalUsage = currentUsage + requestedUsage
    const allowed = totalUsage <= limit
    const remaining = Math.max(0, limit - currentUsage)
    
    if (!allowed) {
      apiLogger.warn('Plan limit exceeded', {
        plan,
        feature,
        currentUsage,
        requestedUsage,
        limit
      })
    }
    
    return { allowed, limit, remaining }
  }

  /**
   * Calculate subscription price
   */
  static calculateSubscriptionPrice(
    plan: string,
    billingCycle: 'monthly' | 'annual'
  ): { amount: number; currency: string; savings?: number } {
    const monthlyPrices: Record<string, number> = {
      starter: 29,
      pro: 99,
      enterprise: 299
    }
    
    const monthlyPrice = monthlyPrices[plan]
    if (!monthlyPrice) {
      throw new ValidationError(`Invalid plan: ${plan}`)
    }
    
    if (billingCycle === 'monthly') {
      return {
        amount: monthlyPrice * 100, // Convert to cents
        currency: 'usd'
      }
    } else {
      // Annual billing with 20% discount
      const annualPrice = monthlyPrice * 12 * 0.8
      const savings = (monthlyPrice * 12) - annualPrice
      
      return {
        amount: Math.round(annualPrice * 100), // Convert to cents
        currency: 'usd',
        savings: Math.round(savings)
      }
    }
  }

  /**
   * Validate refund request
   */
  static validateRefundRequest(data: any): void {
    const refundSchema = z.object({
      subscriptionId: z.string(),
      reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer', 'other']),
      amount: currencySchema.optional(),
      description: z.string().max(500)
    })
    
    try {
      refundSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid refund request', error.errors)
      }
      throw error
    }
  }

  /**
   * Validate billing address
   */
  static validateBillingAddress(address: any): void {
    const billingAddressSchema = z.object({
      line1: z.string().min(1),
      line2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().length(2),
      postal_code: z.string().regex(/^\d{5}(?:-\d{4})?$/),
      country: z.string().length(2).default('US')
    })
    
    try {
      billingAddressSchema.parse(address)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid billing address', error.errors)
      }
      throw error
    }
  }

  /**
   * Create safe subscription object for database
   */
  static prepareDatabaseRecord(subscription: any): Record<string, any> {
    return {
      plan_id: subscription.planId,
      billing_cycle: subscription.billingCycle,
      status: subscription.status || 'active',
      current_period_start: subscription.currentPeriodStart || new Date().toISOString(),
      current_period_end: subscription.currentPeriodEnd,
      stripe_subscription_id: subscription.stripeSubscriptionId,
      stripe_customer_id: subscription.stripeCustomerId,
      updated_at: new Date().toISOString()
    }
  }

  /**
   * Check if plan upgrade is valid
   */
  static canUpgradePlan(currentPlan: string, newPlan: string): boolean {
    const planHierarchy: Record<string, number> = {
      'starter': 1,
      'professional': 2,
      'enterprise': 3
    }
    
    return (planHierarchy[newPlan] || 0) > (planHierarchy[currentPlan] || 0)
  }

  /**
   * Check if plan downgrade is valid
   */
  static canDowngradePlan(currentPlan: string, newPlan: string): boolean {
    const planHierarchy: Record<string, number> = {
      'starter': 1,
      'professional': 2,
      'enterprise': 3
    }
    
    return (planHierarchy[newPlan] || 0) < (planHierarchy[currentPlan] || 0)
  }

  /**
   * Validate plan change is allowed
   */
  static validatePlanChange(currentPlan: string, newPlan: string, allowDowngrade = false): void {
    // Validate plan types
    try {
      planTypeSchema.parse(currentPlan)
      planTypeSchema.parse(newPlan)
    } catch (_error) {
      throw new UserFriendlyError(
        'Invalid plan type',
        'Please select a valid subscription plan',
        'VALIDATION_ERROR'
      )
    }

    if (currentPlan === newPlan) {
      throw new UserFriendlyError(
        'Invalid plan change',
        'You are already on this plan',
        'VALIDATION_ERROR'
      )
    }

    if (!allowDowngrade && this.canDowngradePlan(currentPlan, newPlan)) {
      throw new UserFriendlyError(
        'Plan downgrade not allowed',
        'Please contact support to downgrade your plan',
        'VALIDATION_ERROR'
      )
    }
  }
}