#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function fullSAMSync() {
  console.log('🚀 Starting Full SAM.gov Sync')
  console.log('Target: ~45,608 opportunities')
  console.log('=====================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const samApiKey = process.env.SAM_GOV_API_KEY

  if (!supabaseUrl || !supabaseKey || !samApiKey) {
    console.error('❌ Missing environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Get current count
  const { count: currentCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 Current database count: ${currentCount}`)

  let totalAdded = 0
  let totalAPICallsUsed = 0
  let pageSize = 1000 // Maximum per API call
  let currentOffset = 0

  // Date range for comprehensive sync (last 30 days of opportunities)
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)

  const postedFrom = formatDateForSAM(startDate)
  const postedTo = formatDateForSAM(endDate)

  console.log(`📅 Syncing opportunities from ${postedFrom} to ${postedTo}`)
  console.log('⚡ Using batch processing to minimize API calls\n')

  try {
    while (true) {
      console.log(`🔄 Fetching batch ${Math.floor(currentOffset / pageSize) + 1} (offset: ${currentOffset})`)
      
      const url = new URL('https://api.sam.gov/opportunities/v2/search')
      url.searchParams.append('api_key', samApiKey)
      url.searchParams.append('active', 'true')
      url.searchParams.append('latest', 'true')
      url.searchParams.append('postedFrom', postedFrom)
      url.searchParams.append('postedTo', postedTo)
      url.searchParams.append('limit', pageSize.toString())
      url.searchParams.append('offset', currentOffset.toString())
      
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MedContractHub/1.0'
        }
      })

      totalAPICallsUsed++

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ API Error: ${response.status}`, errorText)
        break
      }

      const data = await response.json()
      
      console.log(`   📈 API returned ${data.opportunitiesData?.length || 0} opportunities`)
      console.log(`   📊 Total records available: ${data.totalRecords || 'unknown'}`)

      if (!data.opportunitiesData || data.opportunitiesData.length === 0) {
        console.log('✅ No more opportunities to fetch')
        break
      }

      // Transform and insert opportunities
      const opportunities = data.opportunitiesData.map((opp: any) => ({
        notice_id: opp.noticeId,
        title: opp.title || 'Unknown Title',
        description: opp.description || '',
        agency: opp.fullParentPathName || opp.agency || 'UNKNOWN',
        sub_agency: opp.subAgency || null,
        office: opp.office || null,
        posted_date: opp.postedDate || new Date().toISOString(),
        response_deadline: opp.responseDeadLine || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        archive_date: opp.archiveDate || null,
        naics_code: opp.naicsCode || null,
        naics_description: opp.classificationCode || null,
        place_of_performance_state: opp.placeOfPerformance?.state?.name || null,
        place_of_performance_city: opp.placeOfPerformance?.city?.name || null,
        set_aside_type: opp.typeOfSetAside || null,
        contract_type: opp.type || null,
        solicitation_number: opp.solicitationNumber || null,
        sam_url: opp.uiLink || null,
        additional_info: opp, // Store complete raw data in additional_info
        status: 'active'
      })).filter(opp => 
        // Filter out opportunities with invalid data
        opp.notice_id && 
        opp.title && 
        opp.posted_date &&
        opp.response_deadline
      )

      // Batch insert with conflict resolution
      const { data: inserted, error } = await supabase
        .from('opportunities')
        .upsert(opportunities, {
          onConflict: 'notice_id',
          ignoreDuplicates: false
        })
        .select('notice_id')

      if (error) {
        console.error('❌ Database error:', error)
        break
      }

      const addedCount = inserted?.length || 0
      totalAdded += addedCount
      
      console.log(`   ✅ Added ${addedCount} new opportunities`)
      console.log(`   📊 Total added so far: ${totalAdded}`)
      console.log(`   🔄 API calls used: ${totalAPICallsUsed}`)
      console.log('')

      // Check if we've reached the end
      if (data.opportunitiesData.length < pageSize) {
        console.log('✅ Reached end of available data')
        break
      }

      // Move to next batch
      currentOffset += pageSize

      // Safety check - don't use more than 800 API calls
      if (totalAPICallsUsed >= 800) {
        console.log('⚠️  Reached API call limit for safety (800 calls)')
        console.log('   Run this script again tomorrow to continue syncing')
        break
      }

      // Small delay to be respectful to SAM.gov API
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Final count check
    const { count: finalCount } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })

    console.log('\n🎉 Sync Complete!')
    console.log('=====================================')
    console.log(`📊 Starting count: ${currentCount}`)
    console.log(`📈 Final count: ${finalCount}`)
    console.log(`➕ New opportunities added: ${totalAdded}`)
    console.log(`🔄 API calls used: ${totalAPICallsUsed}`)
    console.log(`💡 Remaining API calls today: ${1000 - totalAPICallsUsed}`)
    
    if (finalCount && finalCount > 40000) {
      console.log('🎯 Excellent! You now have comprehensive opportunity data')
    } else if (totalAPICallsUsed >= 800) {
      console.log('⏰ Partial sync complete - run again tomorrow for more data')
    }

  } catch (error) {
    console.error('❌ Sync failed:', error)
  }
}

function formatDateForSAM(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}

fullSAMSync()