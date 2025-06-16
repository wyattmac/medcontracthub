/**
 * Billing Portal API
 * Create Stripe billing portal session
 * 
 * Uses Context7-based Zod validation for type safety
 * Reference: /zod/zod - v3 schema validation
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler-next15'
import { createBillingPortalSession } from '@/lib/stripe/subscription-manager'
import { NotFoundError } from '@/lib/errors/types'
import { billingPortalRequestSchema } from '@/lib/validation/schemas/billing'

export const POST = routeHandler.POST(
  async ({ user, supabase, sanitizedBody }) => {
    const { returnUrl } = sanitizedBody || {}
    // Get user's Stripe customer ID
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!subscription?.stripe_customer_id) {
      throw new NotFoundError('No billing information found')
    }

    // Create billing portal session with optional return URL
    const url = await createBillingPortalSession(
      subscription.stripe_customer_id,
      returnUrl
    )

    return NextResponse.json({ url })
  },
  { 
    requireAuth: true,
    validateBody: billingPortalRequestSchema
  }
)