/**
 * Billing Checkout API
 * Create Stripe checkout session for new subscriptions
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler'
import { createCheckoutSession } from '@/lib/stripe/subscription-manager'
import { logUnauthorizedAccess } from '@/lib/security/security-monitor'
import { z } from 'zod'

const checkoutSchema = z.object({
  planId: z.enum(['starter', 'professional', 'enterprise'])
})

export const POST = routeHandler.POST(
  async ({ user, supabase, sanitizedBody, request }) => {
    const { planId } = sanitizedBody
    
    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (!profile?.email) {
      // Log unauthorized access attempt
      await logUnauthorizedAccess(
        request.headers.get('x-forwarded-for') || 'unknown',
        'billing_checkout_no_email',
        user.id
      )
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
    validateBody: checkoutSchema,
    rateLimit: 'api',
    requireCSRF: true
  }
)