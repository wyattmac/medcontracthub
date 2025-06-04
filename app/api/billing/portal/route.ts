/**
 * Billing Portal API
 * Create Stripe billing portal session
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler'
import { createBillingPortalSession } from '@/lib/stripe/subscription-manager'
import { NotFoundError } from '@/lib/errors/types'

export const POST = routeHandler.POST(
  async ({ user, supabase }) => {
    // Get user's Stripe customer ID
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!subscription?.stripe_customer_id) {
      throw new NotFoundError('No billing information found')
    }

    // Create billing portal session
    const url = await createBillingPortalSession(subscription.stripe_customer_id)

    return NextResponse.json({ url })
  },
  { requireAuth: true }
)