/**
 * Stripe Webhook Handlers
 * Processes Stripe webhook events for subscription lifecycle management
 */

import Stripe from 'stripe'
import { getStripe } from './client'
import { createServiceClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/errors/logger'
import { sendEmail } from '@/lib/email/client'
import { SubscriptionCreated, SubscriptionUpdated, SubscriptionCanceled, PaymentFailed } from '@/emails'

type WebhookHandler = (event: Stripe.Event) => Promise<void>

/**
 * Map of Stripe event types to their handlers
 */
export const webhookHandlers: Record<string, WebhookHandler> = {
  'customer.subscription.created': handleSubscriptionCreated,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionDeleted,
  'customer.subscription.trial_will_end': handleTrialWillEnd,
  'invoice.payment_succeeded': handleInvoicePaymentSucceeded,
  'invoice.payment_failed': handleInvoicePaymentFailed,
  'checkout.session.completed': handleCheckoutSessionCompleted,
  'payment_method.attached': handlePaymentMethodAttached,
  'payment_method.detached': handlePaymentMethodDetached
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const supabase = createServiceClient()

  // Find user by Stripe customer ID
  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (!existingSubscription) {
    apiLogger.error('No user found for Stripe customer', new Error('User not found'), {
      customerId: subscription.customer
    })
    return
  }

  // Update subscription record
  const { error } = await supabase
    .from('subscriptions')
    .update({
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', subscription.customer)

  if (error) {
    throw error
  }

  // Send confirmation email
  const { data: user } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', existingSubscription.user_id)
    .single()

  if (user?.email) {
    await sendEmail({
      to: user.email,
      subject: 'Welcome to MedContractHub!',
      react: SubscriptionCreated({
        userName: user.full_name || 'there',
        planName: subscription.items.data[0]?.price.nickname || 'Premium',
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined
      })
    })
  }

  apiLogger.info('Subscription created', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status
  })
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const supabase = createServiceClient()

  // Update subscription record
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    throw error
  }

  apiLogger.info('Subscription updated', {
    subscriptionId: subscription.id,
    status: subscription.status
  })
}

/**
 * Handle subscription deleted (canceled)
 */
async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const supabase = createServiceClient()

  // Update subscription status
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)
    .select('user_id')
    .single()

  if (error) {
    throw error
  }

  // Send cancellation email
  if (data?.user_id) {
    const { data: user } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', data.user_id)
      .single()

    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: 'Your MedContractHub subscription has been canceled',
        react: SubscriptionCanceled({
          userName: user.full_name || 'there',
          endDate: new Date(subscription.current_period_end * 1000)
        })
      })
    }
  }

  apiLogger.info('Subscription canceled', {
    subscriptionId: subscription.id
  })
}

/**
 * Handle trial ending soon
 */
async function handleTrialWillEnd(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const supabase = createServiceClient()

  // Get user details
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (data?.user_id) {
    const { data: user } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', data.user_id)
      .single()

    if (user?.email && subscription.trial_end) {
      await sendEmail({
        to: user.email,
        subject: 'Your MedContractHub trial is ending soon',
        react: SubscriptionUpdated({
          userName: user.full_name || 'there',
          message: 'Your trial period is ending in 3 days. Add a payment method to continue using MedContractHub.',
          trialEnd: new Date(subscription.trial_end * 1000)
        })
      })
    }
  }

  apiLogger.info('Trial ending notification sent', {
    subscriptionId: subscription.id
  })
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  const supabase = createServiceClient()

  if (!invoice.subscription || !invoice.customer) return

  // Get user ID
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', invoice.customer)
    .single()

  if (!subscription) return

  // Record invoice
  const { error } = await supabase
    .from('invoices')
    .insert({
      user_id: subscription.user_id,
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_paid,
      currency: invoice.currency,
      status: 'paid',
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      paid_at: new Date().toISOString()
    })

  if (error) {
    apiLogger.error('Failed to record invoice', error)
  }

  apiLogger.info('Invoice payment succeeded', {
    invoiceId: invoice.id,
    amount: invoice.amount_paid
  })
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  const supabase = createServiceClient()

  if (!invoice.subscription || !invoice.customer) return

  // Get user details
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', invoice.customer)
    .single()

  if (subscription?.user_id) {
    const { data: user } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', subscription.user_id)
      .single()

    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: 'Payment failed for your MedContractHub subscription',
        react: PaymentFailed({
          userName: user.full_name || 'there',
          amount: formatPrice(invoice.amount_due),
          nextAttempt: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000) : undefined
        })
      })
    }

    // Record failed invoice
    await supabase
      .from('invoices')
      .insert({
        user_id: subscription.user_id,
        stripe_invoice_id: invoice.id,
        amount_cents: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        invoice_pdf: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url
      })
  }

  apiLogger.warn('Invoice payment failed', {
    invoiceId: invoice.id,
    amount: invoice.amount_due
  })
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session
  const supabase = createServiceClient()

  if (!session.customer || !session.subscription) return

  // Update subscription with Stripe IDs
  const { error } = await supabase
    .from('subscriptions')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', session.client_reference_id)

  if (error) {
    throw error
  }

  apiLogger.info('Checkout session completed', {
    sessionId: session.id,
    customerId: session.customer
  })
}

/**
 * Handle payment method attached
 */
async function handlePaymentMethodAttached(event: Stripe.Event) {
  const paymentMethod = event.data.object as Stripe.PaymentMethod
  const supabase = createServiceClient()

  if (!paymentMethod.customer) return

  // Get user ID
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', paymentMethod.customer)
    .single()

  if (!subscription) return

  // Record payment method
  const { error } = await supabase
    .from('payment_methods')
    .insert({
      user_id: subscription.user_id,
      stripe_payment_method_id: paymentMethod.id,
      type: paymentMethod.type,
      last_four: paymentMethod.card?.last4,
      brand: paymentMethod.card?.brand,
      exp_month: paymentMethod.card?.exp_month,
      exp_year: paymentMethod.card?.exp_year
    })

  if (error) {
    apiLogger.error('Failed to record payment method', error)
  }

  apiLogger.info('Payment method attached', {
    paymentMethodId: paymentMethod.id,
    type: paymentMethod.type
  })
}

/**
 * Handle payment method detached
 */
async function handlePaymentMethodDetached(event: Stripe.Event) {
  const paymentMethod = event.data.object as Stripe.PaymentMethod
  const supabase = createServiceClient()

  // Remove payment method record
  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('stripe_payment_method_id', paymentMethod.id)

  if (error) {
    apiLogger.error('Failed to remove payment method', error)
  }

  apiLogger.info('Payment method detached', {
    paymentMethodId: paymentMethod.id
  })
}

/**
 * Helper function to format price
 */
function formatPrice(amountInCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amountInCents / 100)
}