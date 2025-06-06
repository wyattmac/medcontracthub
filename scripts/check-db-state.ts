#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabaseState() {
  try {
    console.log('🔍 Checking current database state...\n')

    // Check opportunities count
    const { count: totalOpportunities, error: countError } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('❌ Error counting opportunities:', countError)
      return
    }

    console.log(`📊 Total opportunities in database: ${totalOpportunities}`)

    // Check recent opportunities
    const { data: recentOpps, error: recentError } = await supabase
      .from('opportunities')
      .select('id, title, posted_date, response_deadline, notice_id')
      .order('created_at', { ascending: false })
      .limit(10)

    if (recentError) {
      console.error('❌ Error fetching recent opportunities:', recentError)
      return
    }

    console.log('\n📋 Recent opportunities:')
    recentOpps?.forEach((opp, index) => {
      console.log(`${index + 1}. ${opp.title} (Notice ID: ${opp.notice_id})`)
      console.log(`   Posted: ${opp.posted_date}, Closes: ${opp.response_deadline}`)
    })

    // Check for test data
    const { count: testCount, error: testError } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .ilike('title', '%test%')

    if (!testError) {
      console.log(`\n🧪 Test opportunities: ${testCount}`)
    }

    // Check database tables and indexes
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_info')
      .select()

    if (!tablesError && tables) {
      console.log('\n📁 Database tables:')
      tables.forEach((table: any) => {
        console.log(`- ${table.table_name} (${table.row_count} rows)`)
      })
    }

  } catch (error) {
    console.error('❌ Database check failed:', error)
  }
}

checkDatabaseState()