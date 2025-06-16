/**
 * Billing Subscription API
 * Get subscription details, usage, and invoices
 * Update subscription settings (plan, cancellation)
 * 
 * Uses Context7-based Zod validation for type safety
 * Reference: /zod/zod - v3 schema validation
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler-next15'
import { getSubscriptionDetails, updateSubscription, cancelSubscription } from '@/lib/stripe/subscription-manager'
import { getUsageSummary } from '@/lib/usage/tracker'
import { updateSubscriptionSchema } from '@/lib/validation/schemas/billing'
import { NotFoundError } from '@/lib/errors/types'

export const GET = routeHandler.GET(
  async ({ user }) => {
    // Get subscription details
    const subscriptionData = await getSubscriptionDetails(user.id)
    
    // Get usage summary
    let usage = {}
    try {
      usage = await getUsageSummary(user.id)
    } catch (error) {
      // Don't fail if usage tracking fails
      console.error('Failed to get usage summary:', error)
    }

    return NextResponse.json({
      subscription: subscriptionData.subscription,
      usage,
      invoices: subscriptionData.invoices
    })
  },
  { requireAuth: true }
)

export const PATCH = routeHandler.PATCH(
  async ({ user, supabase, sanitizedBody }) => {
    const { planId, cancelAtPeriodEnd } = sanitizedBody
    
    // Get current subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (!subscription) {
      throw new NotFoundError('No active subscription found')
    }
    
    let updatedSubscription
    
    // Handle plan upgrade/downgrade
    if (planId && planId !== subscription.plan) {
      updatedSubscription = await updateSubscription(
        subscription.stripe_subscription_id,
        planId
      )
    }
    
    // Handle cancellation toggle
    if (cancelAtPeriodEnd !== undefined) {
      if (cancelAtPeriodEnd) {
        updatedSubscription = await cancelSubscription(
          subscription.stripe_subscription_id,
          true // cancelAtPeriodEnd
        )
      } else {
        // Reactivate subscription
        updatedSubscription = await updateSubscription(
          subscription.stripe_subscription_id,
          subscription.plan,
          { cancelAtPeriodEnd: false }
        )
      }
    }
    
    return NextResponse.json({ 
      subscription: updatedSubscription || subscription 
    })
  },
  { 
    requireAuth: true,
    validateBody: updateSubscriptionSchema,
    rateLimit: 'api'
  }
)