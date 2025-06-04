/**
 * Billing Checkout API
 * Create Stripe checkout session for new subscriptions
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler'
import { createCheckoutSession } from '@/lib/stripe/subscription-manager'
import { z } from 'zod'

const checkoutSchema = z.object({
  planId: z.enum(['starter', 'professional', 'enterprise'])
})

export const POST = routeHandler.POST(
  async ({ user, supabase }, { planId }) => {
    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (!profile?.email) {
      throw new Error('User email not found')
    }

    // Create checkout session
    const url = await createCheckoutSession(
      user.id,
      profile.email,
      planId
    )

    return NextResponse.json({ url })
  },
  { 
    requireAuth: true,
    validateBody: checkoutSchema
  }
)