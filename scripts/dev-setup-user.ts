#!/usr/bin/env tsx
/**
 * Enhanced developer setup script with various options
 * 
 * Usage:
 * npm run dev-setup <email> [options]
 * 
 * Options:
 * --plan <starter|pro|enterprise>  - Set subscription plan (default: pro)
 * --trial                          - Set up as trial user (default)
 * --active                         - Set up as active subscriber
 * --admin                          - Make user admin (default)
 * --user                           - Make user regular user
 * --reset                          - Reset existing user data
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { config } from 'dotenv'
import { resolve } from 'path'
import { parseArgs } from 'util'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

// Create Supabase client
const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

interface SetupOptions {
  email: string
  plan: 'starter' | 'pro' | 'enterprise'
  status: 'trialing' | 'active'
  role: 'admin' | 'user'
  reset: boolean
}

async function setupDeveloperUser(options: SetupOptions) {
  const { email, plan, status, role, reset } = options

  console.log(`\n🚀 Setting up developer user: ${email}`)
  console.log(`   Plan: ${plan} | Status: ${status} | Role: ${role}\n`)

  try {
    // Find user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    if (profileError || !profile) {
      console.error('❌ User not found. Please sign up first.')
      return
    }

    // Reset if requested
    if (reset && profile.company_id) {
      console.log('🔄 Resetting user data...')
      
      // Delete company data
      await supabase.from('saved_opportunities').delete().eq('user_id', profile.id)
      await supabase.from('proposals').delete().eq('company_id', profile.company_id)
      await supabase.from('subscriptions').delete().eq('user_id', profile.id)
      await supabase.from('companies').delete().eq('id', profile.company_id)
      
      // Reset profile
      await supabase
        .from('profiles')
        .update({
          company_id: null,
          onboarding_completed: false
        })
        .eq('id', profile.id)
      
      console.log('✅ User data reset')
    }

    // Create company
    console.log('📦 Creating company...')
    const companyData = {
      name: `${email.split('@')[0]}'s Company`,
      description: 'Medical equipment distributor specializing in federal contracts',
      address_line1: '1234 Medical Plaza',
      address_line2: 'Suite 100',
      city: 'San Francisco',
      state: 'CA',
      zip_code: '94105',
      phone: '(415) 555-0123',
      website: `https://${email.split('@')[0]}.example.com`,
      certifications: ['wosb', 'sdvosb', 'hubzone'],
      naics_codes: ['339112', '423450', '621999'],
      subscription_plan: plan,
      subscription_status: status,
      ein: `${Math.floor(Math.random() * 90 + 10)}-${Math.floor(Math.random() * 9000000 + 1000000)}`,
      duns_number: Math.floor(Math.random() * 900000000 + 100000000).toString(),
      cage_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      sam_registration_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      sam_expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert([companyData])
      .select()
      .single()

    if (companyError || !company) {
      console.error('❌ Failed to create company:', companyError?.message)
      return
    }

    console.log('✅ Company created:', company.name)

    // Update profile
    console.log('👤 Updating profile...')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        company_id: company.id,
        onboarding_completed: true,
        full_name: profile.full_name || email.split('@')[0],
        title: role === 'admin' ? 'CEO' : 'Sales Manager',
        phone: '(415) 555-0123',
        role,
        email_notifications: true
      })
      .eq('id', profile.id)

    if (updateError) {
      console.error('❌ Failed to update profile:', updateError.message)
      await supabase.from('companies').delete().eq('id', company.id)
      return
    }

    console.log('✅ Profile updated')

    // Create subscription
    console.log('💳 Setting up subscription...')
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert([{
        user_id: profile.id,
        status,
        stripe_customer_id: `cus_dev_${Date.now()}`,
        stripe_subscription_id: `sub_dev_${Date.now()}`,
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trial_end: status === 'trialing' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
        metadata: { plan }
      }])

    if (!subError) {
      console.log('✅ Subscription created')
    }

    // Create some sample saved opportunities
    console.log('🎯 Adding sample saved opportunities...')
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('id')
      .limit(5)

    if (opportunities && opportunities.length > 0) {
      const savedOpps = opportunities.map(opp => ({
        user_id: profile.id,
        opportunity_id: opp.id,
        notes: 'Looks promising for our medical equipment line',
        is_pursuing: true,
        tags: ['medical', 'equipment'],
        reminder_date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      }))

      await supabase.from('saved_opportunities').insert(savedOpps)
      console.log(`✅ Added ${savedOpps.length} sample saved opportunities`)
    }

    // Summary
    console.log('\n🎉 Developer setup complete!\n')
    console.log('📋 Account Details:')
    console.log(`   Email: ${email}`)
    console.log(`   Company: ${company.name}`)
    console.log(`   CAGE Code: ${company.cage_code}`)
    console.log(`   Plan: ${plan} (${status})`)
    console.log(`   Role: ${role}`)
    console.log('\n📊 Usage Limits:')
    if (plan === 'starter') {
      console.log('   AI Queries: 10/month')
      console.log('   OCR Documents: 5/month')
      console.log('   Email Alerts: 50/month')
    } else if (plan === 'pro') {
      console.log('   AI Queries: 100/month')
      console.log('   OCR Documents: 50/month')
      console.log('   Email Alerts: 500/month')
    } else {
      console.log('   AI Queries: Unlimited')
      console.log('   OCR Documents: Unlimited')
      console.log('   Email Alerts: Unlimited')
    }
    console.log('\n✨ You can now log in and access all features!')

  } catch (error) {
    console.error('\n❌ Setup failed:', error)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const email = args[0]

if (!email || !email.includes('@')) {
  console.error('❌ Please provide a valid email address')
  console.error('\nUsage: npm run dev-setup <email> [options]')
  console.error('\nOptions:')
  console.error('  --plan <starter|pro|enterprise>  Set subscription plan (default: pro)')
  console.error('  --trial                          Set up as trial user (default)')
  console.error('  --active                         Set up as active subscriber')
  console.error('  --admin                          Make user admin (default)')
  console.error('  --user                           Make user regular user')
  console.error('  --reset                          Reset existing user data')
  console.error('\nExample: npm run dev-setup dev@example.com --plan=enterprise --active')
  process.exit(1)
}

// Parse options
const options: SetupOptions = {
  email,
  plan: 'pro',
  status: 'trialing',
  role: 'admin',
  reset: false
}

// Simple argument parsing
for (let i = 1; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--plan' && args[i + 1]) {
    options.plan = args[i + 1] as any
    i++
  } else if (arg.startsWith('--plan=')) {
    options.plan = arg.split('=')[1] as any
  } else if (arg === '--trial') {
    options.status = 'trialing'
  } else if (arg === '--active') {
    options.status = 'active'
  } else if (arg === '--admin') {
    options.role = 'admin'
  } else if (arg === '--user') {
    options.role = 'user'
  } else if (arg === '--reset') {
    options.reset = true
  }
}

// Run setup
setupDeveloperUser(options).catch(console.error)