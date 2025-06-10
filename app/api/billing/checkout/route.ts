/**
 * Billing Checkout API
 * Create Stripe checkout session for new subscriptions
 * 
 * Uses Context7-based Zod validation for type safety
 * Reference: /zod/zod - v3 schema validation
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler'
import { createCheckoutSession } from '@/lib/stripe/subscription-manager'
import { logUnauthorizedAccess } from '@/lib/security/security-monitor'
import { checkoutRequestSchema } from '@/lib/validation/schemas/billing'

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
    validateBody: checkoutRequestSchema,
    rateLimit: 'api',
    requireCSRF: true
  }
)