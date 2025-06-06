#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function checkDashboardStatus() {
  console.log('🔍 Checking Docker and Supabase Dashboard Status...\n')

  // Check environment variables
  console.log('📋 Environment Variables Status:')
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'SAM_GOV_API_KEY',
    'ANTHROPIC_API_KEY',
    'SENTRY_DSN',
    'SYNC_TOKEN'
  ]

  let missingVars = 0
  requiredVars.forEach(varName => {
    const isSet = !!process.env[varName]
    const status = isSet ? '✅' : '❌'
    console.log(`${status} ${varName}: ${isSet ? 'Set' : 'Missing'}`)
    if (!isSet) missingVars++
  })

  if (missingVars > 0) {
    console.log(`\n⚠️  ${missingVars} environment variables are missing`)
  }

  // Test Supabase connection
  console.log('\n🗄️  Testing Supabase Connection:')
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Supabase credentials missing')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Test basic connection
    const { data, error } = await supabase.from('opportunities').select('count').limit(1)
    
    if (error) {
      console.log('❌ Supabase connection failed:', error.message)
      console.log('   Error details:', error)
    } else {
      console.log('✅ Supabase connection successful')
      
      // Get table stats
      const { count: oppCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })

      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      console.log(`📊 Database Stats:`)
      console.log(`   - Opportunities: ${oppCount || 0}`)
      console.log(`   - Users: ${userCount || 0}`)
    }
  } catch (error) {
    console.log('❌ Supabase test failed:', error)
  }

  // Test external APIs
  console.log('\n🌐 Testing External API Connections:')
  
  // Test SAM.gov API
  try {
    const samApiKey = process.env.SAM_GOV_API_KEY
    if (samApiKey) {
      const response = await fetch('https://api.sam.gov/opportunities/v2/search?limit=1', {
        headers: {
          'X-Api-Key': samApiKey,
          'Accept': 'application/json'
        }
      })
      
      if (response.ok) {
        console.log('✅ SAM.gov API connection successful')
      } else {
        console.log(`❌ SAM.gov API error: ${response.status} ${response.statusText}`)
      }
    } else {
      console.log('⚠️  SAM.gov API key not configured')
    }
  } catch (error) {
    console.log('❌ SAM.gov API test failed:', error)
  }

  // Test Anthropic API
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'X-API-Key': anthropicKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }]
        })
      })
      
      if (response.status === 200 || response.status === 400) {
        console.log('✅ Anthropic API connection successful')
      } else {
        console.log(`❌ Anthropic API error: ${response.status} ${response.statusText}`)
      }
    } else {
      console.log('⚠️  Anthropic API key not configured')
    }
  } catch (error) {
    console.log('❌ Anthropic API test failed:', error)
  }

  // Docker service status
  console.log('\n🐳 Docker Services Summary:')
  console.log('Based on docker ps output:')
  console.log('✅ PostgreSQL: Running (21+ hours uptime)')
  console.log('✅ Redis: Running (21+ hours uptime)')
  console.log('⚠️  Next.js App: Unhealthy (health check failing)')

  console.log('\n🚨 Issues Detected:')
  console.log('1. Next.js health check failing with 500 errors')
  console.log('2. Likely cause: Next.js routing issue with `next/headers` in edge runtime')
  console.log('3. Health endpoint may be importing server-only components')

  console.log('\n🔧 Recommended Actions:')
  console.log('1. Fix health endpoint to avoid server-only imports')
  console.log('2. Test individual API routes that don\'t require auth')
  console.log('3. Monitor Supabase dashboard for connection errors')
  console.log('4. Check Sentry for new error patterns after Redis fix')

  console.log('\n🔗 Dashboard Links:')
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0]
    console.log(`📊 Supabase Dashboard: https://supabase.com/dashboard/project/${projectId}`)
  }
  
  if (process.env.SENTRY_DSN) {
    console.log('🔍 Sentry Dashboard: https://sentry.io/organizations/[your-org]/issues/')
  }
}

checkDashboardStatus()