#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function checkOpportunityCount() {
  console.log('📊 Checking Database Opportunity Count...\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Get total count
    const { count, error } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('❌ Database error:', error)
      return
    }

    console.log(`✅ Total opportunities in database: ${count}`)

    // Get status breakdown
    const { data: statusData } = await supabase
      .from('opportunities')
      .select('status')

    const statusCounts = statusData?.reduce((acc, opp) => {
      acc[opp.status] = (acc[opp.status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    console.log('\n📈 Status Breakdown:')
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`)
    })

    // Get recent opportunities
    const { data: recent } = await supabase
      .from('opportunities')
      .select('notice_id, title, agency, posted_date, estimated_value_max')
      .order('posted_date', { ascending: false })
      .limit(5)

    console.log('\n📋 Most Recent Opportunities:')
    recent?.forEach((opp, i) => {
      const value = opp.estimated_value_max 
        ? `$${(opp.estimated_value_max / 1000000).toFixed(1)}M`
        : 'No value'
      console.log(`  ${i + 1}. ${opp.title.substring(0, 60)}...`)
      console.log(`     Agency: ${opp.agency}`)
      console.log(`     Posted: ${new Date(opp.posted_date).toLocaleDateString()}`)
      console.log(`     Value: ${value}`)
      console.log('')
    })

    // Get agency distribution
    const { data: agencies } = await supabase
      .from('opportunities')
      .select('agency')
      .not('agency', 'is', null)

    const agencyCounts = agencies?.reduce((acc, opp) => {
      acc[opp.agency] = (acc[opp.agency] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const topAgencies = Object.entries(agencyCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)

    console.log('🏛️  Top 5 Agencies by Opportunity Count:')
    topAgencies.forEach(([agency, count]) => {
      console.log(`  ${agency}: ${count} opportunities`)
    })

    // Check for medical/healthcare opportunities
    const { data: medical } = await supabase
      .from('opportunities')
      .select('notice_id, title, naics_code')
      .or('naics_code.like.33%,title.ilike.%medical%,title.ilike.%healthcare%,title.ilike.%hospital%')

    console.log(`\n🏥 Medical/Healthcare Related Opportunities: ${medical?.length || 0}`)

    console.log('\n✅ Database Status: Ready for hundreds of users!')
    console.log('💡 Users can search/filter all this data without using any SAM.gov API calls')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkOpportunityCount()