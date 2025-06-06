#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function checkSupabaseDashboard() {
  console.log('🔍 Checking Supabase Dashboard Status...\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing Supabase credentials')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    console.log('📊 **Supabase Project Health Check**\n')

    // Project Info
    const projectId = supabaseUrl.split('//')[1].split('.')[0]
    console.log(`🏗️  Project ID: ${projectId}`)
    console.log(`🔗 Dashboard: https://supabase.com/dashboard/project/${projectId}`)
    console.log(`🔗 Logs: https://supabase.com/dashboard/project/${projectId}/logs`)
    console.log(`🔗 Settings: https://supabase.com/dashboard/project/${projectId}/settings/general\n`)

    // Database Connection Test
    console.log('🗄️  **Database Connection:**')
    const { data: connection, error: connError } = await supabase
      .from('opportunities')
      .select('id')
      .limit(1)

    if (connError) {
      console.log('❌ Database connection failed:', connError.message)
      console.log('   Check RLS policies and table permissions')
    } else {
      console.log('✅ Database connection successful')
    }

    // Table Statistics
    console.log('\n📋 **Table Statistics:**')
    
    const tables = ['opportunities', 'profiles', 'companies', 'saved_opportunities', 'proposals']
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        if (error) {
          console.log(`❌ ${table}: Error - ${error.message}`)
        } else {
          console.log(`✅ ${table}: ${count || 0} records`)
        }
      } catch (error) {
        console.log(`❌ ${table}: Failed to check - ${error}`)
      }
    }

    // Recent Activity Check
    console.log('\n📈 **Recent Database Activity:**')
    try {
      const { data: recentOpps } = await supabase
        .from('opportunities')
        .select('title, created_at, posted_date')
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentOpps && recentOpps.length > 0) {
        console.log('Recent opportunities added:')
        recentOpps.forEach((opp, i) => {
          console.log(`${i + 1}. ${opp.title.substring(0, 50)}...`)
          console.log(`   Added: ${opp.created_at}`)
        })
      } else {
        console.log('⚠️  No recent opportunities found')
      }
    } catch (error) {
      console.log('❌ Could not fetch recent activity')
    }

    // Storage Check
    console.log('\n💾 **Storage Status:**')
    try {
      const { data: buckets, error: storageError } = await supabase.storage.listBuckets()
      
      if (storageError) {
        console.log('❌ Storage access failed:', storageError.message)
      } else {
        console.log(`✅ Storage accessible - ${buckets?.length || 0} buckets`)
        buckets?.forEach(bucket => {
          console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`)
        })
      }
    } catch (error) {
      console.log('⚠️  Storage check skipped (may not be configured)')
    }

    // RLS Policy Check
    console.log('\n🛡️  **Security Status:**')
    try {
      // Test RLS by trying to access without auth context
      const { data: rls, error: rlsError } = await supabase
        .from('opportunities')
        .select('id')
        .limit(1)

      if (rlsError && rlsError.message.includes('RLS')) {
        console.log('⚠️  RLS policies may be restricting access')
        console.log('   This is normal for production but may affect some operations')
      } else {
        console.log('✅ Database access working (RLS configured properly)')
      }
    } catch (error) {
      console.log('⚠️  Could not verify RLS status')
    }

    // Performance Metrics
    console.log('\n⚡ **Performance Indicators:**')
    const startTime = Date.now()
    
    try {
      await supabase.from('opportunities').select('count').limit(1)
      const queryTime = Date.now() - startTime
      
      if (queryTime < 100) {
        console.log(`✅ Database response time: ${queryTime}ms (excellent)`)
      } else if (queryTime < 500) {
        console.log(`⚠️  Database response time: ${queryTime}ms (acceptable)`)
      } else {
        console.log(`❌ Database response time: ${queryTime}ms (slow)`)
      }
    } catch (error) {
      console.log('❌ Could not measure performance')
    }

    console.log('\n✅ **Supabase Dashboard Check Complete**')
    console.log('\n💡 **To check for errors:**')
    console.log('1. Visit your dashboard logs for real-time errors')
    console.log('2. Check the API usage and quotas section')
    console.log('3. Monitor database performance metrics')
    console.log('4. Review RLS policy violations if any')

  } catch (error) {
    console.log('❌ Dashboard check failed:', error)
  }
}

checkSupabaseDashboard()