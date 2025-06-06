#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function analyzeMedicalOpportunities() {
  console.log('🏥 Medical Opportunities Analysis')
  console.log('================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Your specific medical NAICS codes
  const medicalNAICS = [
    '325411', '325412', '325413', '325414', // Pharmaceutical Manufacturing
    '334510', // Electromedical Equipment
    '339112', '339113', '339115', // Medical Equipment Manufacturing
    '423450', // Medical Equipment Wholesale
    '541714', '541715', // Research and Development
    '621111', '621112', '621210', '621310', '621320', '621330', '621340', // Ambulatory Health Care
    '621391', '621399', '621410', '621420', '621491', '621492', '621493', '621498',
    '621511', '621512', '621610', '621910', '621991', '621999',
    '622110', '622210', '622310', // Hospitals
    '623110', '623210', '623220', '623311', '623312', '623990', // Nursing Care
    '624110', '624120', '624190', '624210', '624221', '624229', '624230', '624310', '624410'
  ]

  // Get total count
  const { count: totalCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 Total opportunities in database: ${totalCount}`)

  // Check opportunities by NAICS codes
  let naicsOppsCount = 0
  for (const naics of medicalNAICS) {
    const { count } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .like('naics_code', `${naics}%`)
    
    if (count && count > 0) {
      naicsOppsCount += count
      console.log(`   NAICS ${naics}: ${count} opportunities`)
    }
  }

  console.log(`\n🏥 Medical opportunities by NAICS: ${naicsOppsCount}`)

  // Check by medical keywords
  const medicalKeywords = ['medical', 'healthcare', 'hospital', 'surgical', 'pharmaceutical', 'diagnostic']
  let keywordOppsCount = 0

  for (const keyword of medicalKeywords) {
    const { count } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`)
    
    if (count && count > 0) {
      keywordOppsCount += count
      console.log(`   Keyword "${keyword}": ${count} opportunities`)
    }
  }

  console.log(`\n🔍 Medical opportunities by keywords: ${keywordOppsCount}`)

  // Get unique medical opportunities (combination of NAICS + keywords)
  const naicsQuery = medicalNAICS.map(code => `naics_code.like.${code}%`).join(',')
  const keywordQuery = medicalKeywords.map(keyword => 
    `title.ilike.%${keyword}%,description.ilike.%${keyword}%`
  ).join(',')

  const { count: uniqueMedicalCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .or(`${naicsQuery},${keywordQuery}`)

  console.log(`\n🎯 Total unique medical opportunities: ${uniqueMedicalCount}`)

  // Sample medical opportunities
  const { data: samples } = await supabase
    .from('opportunities')
    .select('notice_id, title, agency, naics_code, response_deadline, additional_info')
    .or(`${naicsQuery},${keywordQuery}`)
    .order('response_deadline', { ascending: true })
    .limit(10)

  console.log('\n📋 Sample Medical Opportunities (by deadline):')
  samples?.forEach((opp, i) => {
    console.log(`${i + 1}. ${opp.title.substring(0, 70)}...`)
    console.log(`   Agency: ${opp.agency}`)
    console.log(`   NAICS: ${opp.naics_code || 'N/A'}`)
    console.log(`   Deadline: ${new Date(opp.response_deadline).toLocaleDateString()}`)
    console.log(`   Complete Data: ${opp.additional_info?.completeData ? 'YES' : 'NO'}`)
    console.log('')
  })

  // Check data completeness
  const { data: dataCheck } = await supabase
    .from('opportunities')
    .select('additional_info')
    .or(`${naicsQuery},${keywordQuery}`)

  const completeDataCount = dataCheck?.filter(opp => 
    opp.additional_info && typeof opp.additional_info === 'object' && Object.keys(opp.additional_info).length > 0
  ).length || 0

  console.log(`📊 Data Quality Analysis:`)
  console.log(`   ✅ Opportunities with basic data: ${uniqueMedicalCount}`)
  console.log(`   📝 Opportunities with additional data: ${completeDataCount}`)
  console.log(`   📈 Data completeness: ${((completeDataCount / (uniqueMedicalCount || 1)) * 100).toFixed(1)}%`)

  // Agency breakdown for medical opportunities
  const { data: agencies } = await supabase
    .from('opportunities')
    .select('agency')
    .or(`${naicsQuery},${keywordQuery}`)

  const agencyCounts = agencies?.reduce((acc, opp) => {
    acc[opp.agency] = (acc[opp.agency] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  const topAgencies = Object.entries(agencyCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)

  console.log(`\n🏛️  Top Medical Contract Agencies:`)
  topAgencies.forEach(([agency, count]) => {
    console.log(`   ${agency}: ${count} opportunities`)
  })

  console.log('\n✅ Analysis Complete!')
  console.log(`\n💡 Recommendation: You have ${uniqueMedicalCount} medical opportunities ready to use!`)
  console.log('   🎯 Users can search this medical-focused database without API calls')
  console.log('   📊 Perfect for medical distributors seeking federal contracts')
  console.log('   ⚡ Zero API usage for user searches - all local database queries')
}

analyzeMedicalOpportunities()