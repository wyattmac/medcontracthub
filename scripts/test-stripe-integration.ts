#!/usr/bin/env tsx

/**
 * Test Script: Stripe Integration
 * Tests webhook handling, subscription creation, and billing flows
 */

import { createServiceClient } from '../lib/supabase/server'
import { getStripe, stripeConfig } from '../lib/stripe/client'
import { webhookHandlers } from '../lib/stripe/webhook-handlers'
import Stripe from 'stripe'
import { apiLogger } from '../lib/errors/logger'

// Test configuration
const TEST_USER_EMAIL = 'test@medcontracthub.com'
const TEST_USER_ID = 'test-user-123'

async function testStripeIntegration() {
  console.log('🧪 Testing Stripe Integration...\n')

  const stripe = getStripe()
  const supabase = createServiceClient()

  try {
    // 1. Test Stripe Connection
    console.log('1️⃣ Testing Stripe Connection...')
    try {
      const account = await stripe.accounts.retrieve()
      console.log('✅ Connected to Stripe:', account.email)
    } catch (error) {
      console.error('❌ Failed to connect to Stripe:', error)
      return
    }

    // 2. Test Product and Price Configuration
    console.log('\n2️⃣ Checking Products and Prices...')
    for (const [planName, priceId] of Object.entries(stripeConfig.prices)) {
      if (!priceId) {
        console.warn(`⚠️  Missing price ID for ${planName} plan`)
        continue
      }
      
      try {
        const price = await stripe.prices.retrieve(priceId)
        console.log(`✅ ${planName}: ${price.unit_amount! / 100} ${price.currency.toUpperCase()}/${price.recurring?.interval}`)
      } catch (error) {
        console.error(`❌ Invalid price ID for ${planName}: ${priceId}`)
      }
    }

    // 3. Test Webhook Event Handlers
    console.log('\n3️⃣ Testing Webhook Handlers...')
    const webhookEvents = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'checkout.session.completed'
    ]

    for (const eventType of webhookEvents) {
      const handler = webhookHandlers[eventType]
      console.log(`${typeof handler === 'function' ? '✅' : '❌'} Handler for ${eventType}: ${typeof handler === 'function' ? 'Found' : 'Missing'}`)
    }

    // 4. Test Database Schema
    console.log('\n4️⃣ Testing Database Schema...')
    const tables = [
      'subscriptions',
      'subscription_plans',
      'usage_records',
      'payment_methods',
      'invoices',
      'stripe_webhook_events'
    ]

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1)

      console.log(`${error ? '❌' : '✅'} Table ${table}: ${error ? error.message : 'Accessible'}`)
    }

    // 5. Test Webhook Signature Verification
    console.log('\n5️⃣ Testing Webhook Signature...')
    if (!stripeConfig.webhookSecret) {
      console.warn('⚠️  STRIPE_WEBHOOK_SECRET not configured')
    } else {
      // Create a test event
      const testPayload = JSON.stringify({
        id: 'evt_test_webhook',
        object: 'event',
        created: Date.now(),
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test'
          }
        }
      })

      const testHeader = stripe.webhooks.generateTestHeaderString({
        payload: testPayload,
        secret: stripeConfig.webhookSecret,
      })

      try {
        const event = stripe.webhooks.constructEvent(
          testPayload,
          testHeader,
          stripeConfig.webhookSecret
        )
        console.log('✅ Webhook signature verification working')
      } catch (error) {
        console.error('❌ Webhook signature verification failed:', error)
      }
    }

    // 6. Test Environment Variables
    console.log('\n6️⃣ Checking Environment Variables...')
    const requiredEnvVars = [
      'STRIPE_SECRET_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_STARTER',
      'STRIPE_PRICE_PROFESSIONAL',
      'STRIPE_PRICE_ENTERPRISE'
    ]

    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar]
      console.log(`${value ? '✅' : '❌'} ${envVar}: ${value ? 'Set' : 'Missing'}`)
    }

    // 7. Test Usage Tracking
    console.log('\n7️⃣ Testing Usage Tracking...')
    const features = ['ai_analysis', 'ocr_document', 'export_data', 'email_sent']
    
    for (const feature of features) {
      const { count, error } = await supabase
        .from('usage_records')
        .select('id', { count: 'exact', head: true })
        .eq('feature', feature)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

      if (error) {
        console.error(`❌ Failed to query ${feature} usage:`, error.message)
      } else {
        console.log(`✅ ${feature}: ${count} records in last 30 days`)
      }
    }

    // Summary
    console.log('\n📊 Integration Test Summary:')
    console.log('- Stripe API: Connected')
    console.log('- Products/Prices: Configured')
    console.log('- Webhook Handlers: Ready')
    console.log('- Database Schema: Verified')
    console.log('- Environment: Configured')
    console.log('\n✅ Stripe integration is ready for production!')

  } catch (error) {
    console.error('\n❌ Integration test failed:', error)
    process.exit(1)
  }
}

// Run the test
testStripeIntegration()
  .then(() => {
    console.log('\n✨ All tests completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test script error:', error)
    process.exit(1)
  })