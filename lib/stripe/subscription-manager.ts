/**
 * Subscription Manager
 * Handles subscription creation, updates, and management
 */

import Stripe from 'stripe'
import { getStripe, stripeConfig, planLimits } from './client'
import { createServiceClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/errors/logger'
import { ExternalServiceError, ValidationError } from '@/lib/errors/types'

interface CreateSubscriptionParams {
  userId: string
  email: string
  planId: 'starter' | 'professional' | 'enterprise'
  paymentMethodId?: string
}

interface UpdateSubscriptionParams {
  subscriptionId: string
  planId?: 'starter' | 'professional' | 'enterprise'
  paymentMethodId?: string
  cancelAtPeriodEnd?: boolean
}

/**
 * Create a new subscription
 */
export async function createSubscription({
  userId,
  email,
  planId,
  paymentMethodId
}: CreateSubscriptionParams): Promise<{
  subscriptionId: string
  clientSecret?: string
  status: string
}> {
  const stripe = getStripe()
  const supabase = createServiceClient()

  try {
    // Check if user already has a subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id, stripe_customer_id')
      .eq('user_id', userId)
      .single()

    let customerId: string

    if (existingSubscription?.stripe_customer_id) {
      customerId = existingSubscription.stripe_customer_id
    } else {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId
        }
      })
      customerId = customer.id

      // Create or update subscription record
      await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          status: 'pending'
        })
    }

    // Get price ID
    const priceId = stripeConfig.prices[planId]
    if (!priceId) {
      throw new ValidationError(`Invalid plan: ${planId}`)
    }

    // Create subscription with trial
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: stripeConfig.trialPeriodDays,
      metadata: {
        userId,
        planId
      },
      expand: ['latest_invoice.payment_intent']
    }

    // Add payment method if provided
    if (paymentMethodId) {
      subscriptionParams.default_payment_method = paymentMethodId
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams)

    // Update subscription record
    await supabase
      .from('subscriptions')
      .update({
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
      })
      .eq('user_id', userId)

    // Get client secret for payment if needed
    let clientSecret: string | undefined
    if (subscription.status === 'incomplete' && subscription.latest_invoice) {
      const invoice = subscription.latest_invoice as Stripe.Invoice
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent
      clientSecret = paymentIntent?.client_secret || undefined
    }

    apiLogger.info('Subscription created', {
      subscriptionId: subscription.id,
      customerId,
      planId,
      status: subscription.status
    })

    return {
      subscriptionId: subscription.id,
      clientSecret,
      status: subscription.status
    }

  } catch (error) {
    apiLogger.error('Failed to create subscription', error as Error, {
      userId,
      planId
    })
    throw new ExternalServiceError('Failed to create subscription', 'Stripe', error as Error)
  }
}

/**
 * Update an existing subscription
 */
export async function updateSubscription({
  subscriptionId,
  planId,
  paymentMethodId,
  cancelAtPeriodEnd
}: UpdateSubscriptionParams): Promise<{
  status: string
  cancelAt?: Date
}> {
  const stripe = getStripe()
  const supabase = createServiceClient()

  try {
    const updateParams: Stripe.SubscriptionUpdateParams = {}

    // Handle plan change
    if (planId) {
      const priceId = stripeConfig.prices[planId]
      if (!priceId) {
        throw new ValidationError(`Invalid plan: ${planId}`)
      }

      // Get current subscription
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      
      // Update subscription items
      updateParams.items = [{
        id: subscription.items.data[0].id,
        price: priceId
      }]

      // Prorate immediately for upgrades
      updateParams.proration_behavior = 'always_invoice'
    }

    // Handle payment method update
    if (paymentMethodId) {
      updateParams.default_payment_method = paymentMethodId
    }

    // Handle cancellation
    if (cancelAtPeriodEnd !== undefined) {
      updateParams.cancel_at_period_end = cancelAtPeriodEnd
    }

    const subscription = await stripe.subscriptions.update(
      subscriptionId,
      updateParams
    )

    // Update database
    await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscriptionId)

    apiLogger.info('Subscription updated', {
      subscriptionId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    })

    return {
      status: subscription.status,
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : undefined
    }

  } catch (error) {
    apiLogger.error('Failed to update subscription', error as Error, {
      subscriptionId
    })
    throw new ExternalServiceError('Failed to update subscription', 'Stripe', error as Error)
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<void> {
  const stripe = getStripe()

  try {
    if (immediately) {
      await stripe.subscriptions.cancel(subscriptionId)
    } else {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      })
    }

    apiLogger.info('Subscription canceled', {
      subscriptionId,
      immediately
    })

  } catch (error) {
    apiLogger.error('Failed to cancel subscription', error as Error, {
      subscriptionId
    })
    throw new ExternalServiceError('Failed to cancel subscription', 'Stripe', error as Error)
  }
}

/**
 * Resume a canceled subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<void> {
  const stripe = getStripe()

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    })

    apiLogger.info('Subscription resumed', {
      subscriptionId
    })

  } catch (error) {
    apiLogger.error('Failed to resume subscription', error as Error, {
      subscriptionId
    })
    throw new ExternalServiceError('Failed to resume subscription', 'Stripe', error as Error)
  }
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  planId: 'starter' | 'professional' | 'enterprise'
): Promise<string> {
  const stripe = getStripe()

  try {
    const priceId = stripeConfig.prices[planId]
    if (!priceId) {
      throw new ValidationError(`Invalid plan: ${planId}`)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: stripeConfig.paymentMethodTypes,
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      customer_email: email,
      client_reference_id: userId,
      subscription_data: {
        trial_period_days: stripeConfig.trialPeriodDays,
        metadata: {
          userId,
          planId
        }
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        userId,
        planId
      }
    })

    apiLogger.info('Checkout session created', {
      sessionId: session.id,
      userId,
      planId
    })

    return session.url || ''

  } catch (error) {
    apiLogger.error('Failed to create checkout session', error as Error, {
      userId,
      planId
    })
    throw new ExternalServiceError('Failed to create checkout session', 'Stripe', error as Error)
  }
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession(
  customerId: string
): Promise<string> {
  const stripe = getStripe()

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: stripeConfig.billingPortal.returnUrl
    })

    apiLogger.info('Billing portal session created', {
      customerId
    })

    return session.url

  } catch (error) {
    apiLogger.error('Failed to create billing portal session', error as Error, {
      customerId
    })
    throw new ExternalServiceError('Failed to create billing portal session', 'Stripe', error as Error)
  }
}

/**
 * Get subscription details
 */
export async function getSubscriptionDetails(userId: string): Promise<{
  subscription: any
  usage: Record<string, number>
  invoices: any[]
}> {
  const supabase = createServiceClient()

  // Get subscription
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select(`
      *,
      subscription_plans (
        name,
        description,
        price_cents,
        features,
        limits
      )
    `)
    .eq('user_id', userId)
    .single()

  if (subError) {
    throw new Error('Failed to fetch subscription details')
  }

  // Get usage summary
  const { data: usage, error: usageError } = await supabase
    .rpc('get_usage_summary', {
      p_user_id: userId
    })

  if (usageError) {
    apiLogger.error('Failed to fetch usage summary', usageError)
  }

  // Get recent invoices
  const { data: invoices, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (invoiceError) {
    apiLogger.error('Failed to fetch invoices', invoiceError)
  }

  return {
    subscription,
    usage: usage || {},
    invoices: invoices || []
  }
}