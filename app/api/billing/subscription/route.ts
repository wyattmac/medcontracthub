/**
 * Billing Subscription API
 * Get subscription details, usage, and invoices
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler'
import { getSubscriptionDetails } from '@/lib/stripe/subscription-manager'
import { getUsageSummary } from '@/lib/usage/tracker'

export const GET = routeHandler.GET(
  async ({ user, supabase }) => {
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