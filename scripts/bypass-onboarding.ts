#!/usr/bin/env ts-node

/**
 * Bypass onboarding for development
 * Usage: npm run bypass-onboarding <email>
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function bypassOnboarding(email: string) {
  try {
    console.log(`Bypassing onboarding for ${email}...`)

    // Get the user
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
    if (userError) throw userError

    const user = users.find(u => u.email === email)
    if (!user) {
      console.error(`User with email ${email} not found`)
      process.exit(1)
    }

    // Create a company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: 'Dev Test Company',
        ein: '12-3456789',
        duns_number: '123456789',
        cage_code: 'TEST1',
        naics_codes: ['339112', '339113'], // Medical equipment
        certifications: ['small_business'],
        address_line1: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zip_code: '12345',
        website: 'https://testcompany.com',
        created_by: user.id,
        subscription_plan: 'professional'
      })
      .select()
      .single()

    if (companyError) throw companyError

    // Update user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        company_id: company.id,
        onboarding_completed: true,
        full_name: user.user_metadata?.full_name || 'Dev User',
        phone: '555-0123',
        title: 'Developer'
      })
      .eq('id', user.id)

    if (profileError) throw profileError

    // Create subscription
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        company_id: company.id,
        stripe_subscription_id: `sub_dev_${Date.now()}`,
        stripe_customer_id: `cus_dev_${Date.now()}`,
        status: 'trialing',
        plan_name: 'professional',
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      })

    if (subError) throw subError

    // Create usage tracking
    const { error: usageError } = await supabase
      .from('usage_tracking')
      .insert({
        company_id: company.id,
        billing_period_start: new Date(),
        billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ai_analyses: 0,
        ocr_documents: 0,
        exports: 0,
        searches: 0
      })

    if (usageError) throw usageError

    console.log('✅ Onboarding bypassed successfully!')
    console.log(`Company ID: ${company.id}`)
    console.log(`User can now access the dashboard at http://localhost:3000/dashboard`)

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

// Get email from command line
const email = process.argv[2]
if (!email) {
  console.error('Usage: npm run bypass-onboarding <email>')
  process.exit(1)
}

bypassOnboarding(email)