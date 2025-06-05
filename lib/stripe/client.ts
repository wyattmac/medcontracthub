/**
 * Stripe Client Configuration
 * Handles all Stripe SDK initialization and configuration
 */

import Stripe from 'stripe'
import { loadStripe, Stripe as StripeJS } from '@stripe/stripe-js'

// Server-side Stripe instance
let stripeInstance: Stripe | null = null

/**
 * Get server-side Stripe instance
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }

    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: '2025-05-28.basil',
      typescript: true,
      appInfo: {
        name: 'MedContractHub',
        version: '1.0.0',
        url: 'https://medcontracthub.com'
      }
    })
  }

  return stripeInstance
}

// Client-side Stripe promise
let stripePromise: Promise<StripeJS | null> | null = null

/**
 * Get client-side Stripe instance
 */
export function getStripeJS(): Promise<StripeJS | null> {
  if (!stripePromise) {
    const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

    if (!stripePublishableKey) {
      console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured')
      return Promise.resolve(null)
    }

    stripePromise = loadStripe(stripePublishableKey)
  }

  return stripePromise
}

/**
 * Stripe configuration
 */
export const stripeConfig = {
  // Webhook endpoint secret
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Price IDs for different plans
  prices: {
    starter: process.env.STRIPE_PRICE_STARTER || '',
    professional: process.env.STRIPE_PRICE_PROFESSIONAL || '',
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE || ''
  },

  // Product IDs
  products: {
    starter: process.env.STRIPE_PRODUCT_STARTER || '',
    professional: process.env.STRIPE_PRODUCT_PROFESSIONAL || '',
    enterprise: process.env.STRIPE_PRODUCT_ENTERPRISE || ''
  },

  // Trial period in days
  trialPeriodDays: 14,

  // Currency
  currency: 'usd',

  // Payment method types
  paymentMethodTypes: ['card'] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],

  // Billing portal configuration
  billingPortal: {
    returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`
  }
}

/**
 * Plan limits configuration
 */
export const planLimits = {
  starter: {
    opportunities_per_month: 100,
    ai_analyses_per_month: 20,
    ocr_documents_per_month: 50,
    email_alerts: true,
    export_formats: ['csv'],
    team_members: 1,
    api_access: false
  },
  professional: {
    opportunities_per_month: 1000,
    ai_analyses_per_month: 100,
    ocr_documents_per_month: 200,
    email_alerts: true,
    export_formats: ['csv', 'excel', 'pdf'],
    team_members: 5,
    api_access: true
  },
  enterprise: {
    opportunities_per_month: -1, // Unlimited
    ai_analyses_per_month: -1, // Unlimited
    ocr_documents_per_month: -1, // Unlimited
    email_alerts: true,
    export_formats: ['csv', 'excel', 'pdf'],
    team_members: -1, // Unlimited
    api_access: true,
    priority_support: true,
    custom_integrations: true
  }
}

/**
 * Get plan display name
 */
export function getPlanDisplayName(planId: string): string {
  const planNames: Record<string, string> = {
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise'
  }
  return planNames[planId] || 'Unknown Plan'
}

/**
 * Get plan price in dollars
 */
export function getPlanPrice(planId: string): number {
  const planPrices: Record<string, number> = {
    starter: 29,
    professional: 99,
    enterprise: 299
  }
  return planPrices[planId] || 0
}

/**
 * Format price for display
 */
export function formatPrice(amountInCents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0
  }).format(amountInCents / 100)
}