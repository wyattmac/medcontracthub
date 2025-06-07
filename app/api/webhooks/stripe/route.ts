/**
 * Stripe Webhook Endpoint
 * Handles all incoming Stripe webhook events
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getStripe, stripeConfig } from '@/lib/stripe/client'
import { webhookHandlers } from '@/lib/stripe/webhook-handlers'
import { createServiceClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/errors/logger'
import { ValidationError, ExternalServiceError } from '@/lib/errors/types'
import { rateLimit, RATE_LIMITS, addRateLimitHeaders } from '@/lib/security/rate-limiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for webhook endpoints
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.webhook)
    
    if (!rateLimitResult.success) {
      const response = NextResponse.json(
        { error: 'Too many webhook requests' },
        { status: 429 }
      )
      addRateLimitHeaders(response, rateLimitResult)
      return response
    }

    const body = await request.text()
    const signature = (await headers()).get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }
  } catch (error) {
    apiLogger.error('Webhook rate limiting error', error)
    // Continue processing if rate limiting fails
  }

  if (!stripeConfig.webhookSecret) {
    apiLogger.error('Stripe webhook secret not configured', new Error('Missing STRIPE_WEBHOOK_SECRET'))
    return NextResponse.json(
      { error: 'Webhook endpoint not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      stripeConfig.webhookSecret
    )
  } catch (error) {
    apiLogger.error('Webhook signature verification failed', error as Error)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  // Check for duplicate processing
  const supabase = createServiceClient()
  const { data: existingEvent } = await supabase
    .from('stripe_webhook_events')
    .select('id, processed')
    .eq('id', event.id)
    .single()

  if (existingEvent?.processed) {
    apiLogger.info('Webhook event already processed', { eventId: event.id })
    return NextResponse.json({ received: true, status: 'already_processed' })
  }

  // Record the event
  await supabase
    .from('stripe_webhook_events')
    .upsert({
      id: event.id,
      type: event.type,
      data: event.data,
      created_at: new Date(event.created * 1000).toISOString()
    })

  // Process the event
  try {
    const handler = webhookHandlers[event.type]
    
    if (handler) {
      await handler(event)
      apiLogger.info('Webhook processed successfully', {
        eventId: event.id,
        type: event.type
      })
    } else {
      apiLogger.info('No handler for webhook event type', {
        eventId: event.id,
        type: event.type
      })
    }

    // Mark as processed
    await supabase
      .from('stripe_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('id', event.id)

    return NextResponse.json({
      received: true,
      type: event.type,
      processed: !!handler
    })

  } catch (error) {
    // Record error
    await supabase
      .from('stripe_webhook_events')
      .update({
        error: (error as Error).message,
        processed_at: new Date().toISOString()
      })
      .eq('id', event.id)

    apiLogger.error('Webhook processing failed', error as Error, {
      eventId: event.id,
      type: event.type
    })

    // Return 200 to prevent Stripe from retrying
    // We'll handle retries ourselves if needed
    return NextResponse.json({
      received: true,
      error: 'Processing failed',
      message: (error as Error).message
    })
  }
}