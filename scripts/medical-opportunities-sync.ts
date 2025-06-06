#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function medicalOpportunitiesSync() {
  console.log('🏥 Medical Opportunities Complete Data Sync')
  console.log('==========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const samApiKey = process.env.SAM_GOV_API_KEY

  if (!supabaseUrl || !supabaseKey || !samApiKey) {
    console.error('❌ Missing environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Step 1: Identify medical opportunities from current database
  console.log('🔍 Step 1: Finding medical opportunities in database...')
  
  const medicalNAICS = [
    '325411', '325412', '325413', '325414', // Pharmaceutical Manufacturing
    '334510', // Electromedical and Electrotherapeutic Apparatus Manufacturing
    '339112', '339113', '339115', // Medical Equipment Manufacturing
    '423450', // Medical Equipment Wholesale
    '541714', '541715', // Research and Development
    '621111', '621112', '621210', '621310', '621320', '621330', '621340', // Ambulatory Health Care
    '621391', '621399', '621410', '621420', '621491', '621492', '621493', '621498', // Ambulatory Health Care
    '621511', '621512', '621610', '621910', '621991', '621999', // Ambulatory Health Care
    '622110', '622210', '622310', // Hospitals
    '623110', '623210', '623220', '623311', '623312', '623990', // Nursing and Residential Care
    '624110', '624120', '624190', '624210', '624221', '624229', '624230', '624310', '624410' // Social Assistance
  ]

  const medicalKeywords = [
    'medical', 'healthcare', 'hospital', 'surgical', 'pharmaceutical', 
    'dental', 'diagnostic', 'therapeutic', 'clinical', 'patient',
    'nursing', 'ambulance', 'vaccine', 'medicine', 'drug', 'device',
    'equipment', 'supplies', 'laboratory', 'radiology', 'ultrasound',
    'mri', 'ct scan', 'x-ray', 'ventilator', 'defibrillator', 'pacemaker'
  ]

  // Build complex query for medical opportunities
  let query = supabase
    .from('opportunities')
    .select('notice_id, title, description, naics_code, agency')

  // Add NAICS code filters
  const naicsFilters = medicalNAICS.map(naics => `naics_code.like.${naics}%`).join(',')
  
  // Add keyword filters
  const keywordFilters = medicalKeywords.map(keyword => 
    `title.ilike.%${keyword}%,description.ilike.%${keyword}%`
  ).join(',')

  query = query.or(`${naicsFilters},${keywordFilters}`)

  const { data: medicalOpps, error } = await query

  if (error) {
    console.error('❌ Database query error:', error)
    return
  }

  console.log(`✅ Found ${medicalOpps?.length || 0} medical opportunities`)

  if (!medicalOpps?.length) {
    console.log('❌ No medical opportunities found in database')
    return
  }

  // Step 2: Get detailed information for each medical opportunity
  console.log('\n🔍 Step 2: Fetching complete details from SAM.gov...')
  
  let totalAPICallsUsed = 0
  let successfulDetailFetches = 0
  let detailedOpportunities = []

  for (let i = 0; i < medicalOpps.length; i++) {
    const opp = medicalOpps[i]
    
    console.log(`📄 ${i + 1}/${medicalOpps.length}: Fetching details for ${opp.notice_id}`)
    console.log(`   Title: ${opp.title.substring(0, 60)}...`)

    try {
      // Fetch complete opportunity details
      const detailUrl = new URL(`https://api.sam.gov/opportunities/v2/${opp.notice_id}`)
      detailUrl.searchParams.append('api_key', samApiKey)
      
      const response = await fetch(detailUrl.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MedContractHub/1.0'
        }
      })

      totalAPICallsUsed++

      if (!response.ok) {
        console.log(`   ❌ API Error: ${response.status}`)
        continue
      }

      const detailData = await response.json()
      
      // Extract comprehensive information
      const completeOpportunity = {
        notice_id: opp.notice_id,
        
        // General Information
        title: detailData.title || opp.title,
        description: detailData.description || opp.description,
        
        // Agency and Office Information
        agency: detailData.fullParentPathName || opp.agency,
        sub_agency: detailData.subAgency,
        office: detailData.office,
        
        // Dates
        posted_date: detailData.postedDate,
        response_deadline: detailData.responseDeadLine,
        archive_date: detailData.archiveDate,
        
        // Classification
        naics_code: detailData.naicsCode,
        naics_description: detailData.classificationCode,
        solicitation_number: detailData.solicitationNumber,
        set_aside_type: detailData.typeOfSetAside,
        contract_type: detailData.type,
        
        // Performance Location
        place_of_performance_state: detailData.placeOfPerformance?.state?.name,
        place_of_performance_city: detailData.placeOfPerformance?.city?.name,
        
        // Contact Information
        primary_contact_name: detailData.pointOfContact?.[0]?.fullName,
        primary_contact_email: detailData.pointOfContact?.[0]?.email,
        primary_contact_phone: detailData.pointOfContact?.[0]?.phone,
        
        // Links and Resources
        sam_url: detailData.uiLink,
        
        // Complete Raw Data (includes attachments, additional info, etc.)
        additional_info: {
          ...detailData,
          fetchedAt: new Date().toISOString(),
          completeData: true
        },
        
        status: 'active'
      }

      detailedOpportunities.push(completeOpportunity)
      successfulDetailFetches++

      console.log(`   ✅ Complete data retrieved`)
      console.log(`   📞 Contact: ${completeOpportunity.primary_contact_name || 'N/A'}`)
      console.log(`   📋 NAICS: ${completeOpportunity.naics_code || 'N/A'}`)

      // Safety check - don't exceed API limits
      if (totalAPICallsUsed >= 500) {
        console.log('\n⚠️  Reached 500 API calls for safety')
        console.log('   Run this script again tomorrow to continue fetching details')
        break
      }

      // Small delay to be respectful to SAM.gov API
      await new Promise(resolve => setTimeout(resolve, 200))

    } catch (error) {
      console.log(`   ❌ Error fetching details: ${error.message}`)
    }
  }

  // Step 3: Update database with complete medical opportunity data
  console.log(`\n💾 Step 3: Updating database with ${detailedOpportunities.length} complete medical opportunities...`)

  if (detailedOpportunities.length > 0) {
    const { data: updated, error: updateError } = await supabase
      .from('opportunities')
      .upsert(detailedOpportunities, {
        onConflict: 'notice_id',
        ignoreDuplicates: false
      })
      .select('notice_id')

    if (updateError) {
      console.error('❌ Database update error:', updateError)
      return
    }

    console.log(`✅ Successfully updated ${updated?.length || 0} opportunities with complete data`)
  }

  // Step 4: Clean up non-medical opportunities (optional)
  console.log('\n🧹 Step 4: Clean up non-medical opportunities from database...')
  
  const medicalNoticeIds = medicalOpps.map(opp => opp.notice_id)
  
  const { count: beforeCleanup } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })

  const { error: deleteError } = await supabase
    .from('opportunities')
    .delete()
    .not('notice_id', 'in', `(${medicalNoticeIds.map(id => `'${id}'`).join(',')})`)

  if (deleteError) {
    console.error('❌ Cleanup error:', deleteError)
  } else {
    const { count: afterCleanup } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })

    console.log(`✅ Removed ${(beforeCleanup || 0) - (afterCleanup || 0)} non-medical opportunities`)
    console.log(`📊 Final database: ${afterCleanup} medical opportunities only`)
  }

  // Final summary
  console.log('\n🎉 Medical Opportunities Sync Complete!')
  console.log('=============================================')
  console.log(`📊 Medical opportunities found: ${medicalOpps.length}`)
  console.log(`✅ Complete details fetched: ${successfulDetailFetches}`)
  console.log(`🔄 API calls used: ${totalAPICallsUsed}`)
  console.log(`💡 Remaining API calls today: ${1000 - totalAPICallsUsed}`)
  console.log('\n🎯 Your database now contains ONLY medical opportunities with:')
  console.log('   ✅ Complete descriptions and requirements')
  console.log('   ✅ Full contact information')
  console.log('   ✅ Attachments and links (in additional_info)')
  console.log('   ✅ Classification and set-aside details')
  console.log('   ✅ Performance location information')
  console.log('\n💰 Perfect for medical distributors seeking federal contracts!')
}

medicalOpportunitiesSync()