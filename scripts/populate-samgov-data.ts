#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const samApiKey = process.env.SAM_GOV_API_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

interface SAMOpportunity {
  noticeId: string
  title: string
  agency: string
  subAgency?: string
  office?: string
  postedDate: string
  archiveDate?: string
  archive: {
    date?: string
  }
  responseDeadLine?: string
  naicsCode?: string
  naics?: Array<{
    code?: string
    description?: string
  }>
  placeOfPerformance?: {
    state?: {
      code?: string
    }
    city?: {
      code?: string
    }
  }
  setAsideDescription?: string
  typeOfContractDescription?: string
  award?: {
    date?: string
    amount?: string
    awardee?: {
      name?: string
      duns?: string
    }
  }
  solicitationNumber?: string
  pointOfContact?: Array<{
    fullName?: string
    email?: string
    phone?: string
  }>
  description?: string
}

async function fetchSAMGovOpportunities(daysBack: number = 7, limit: number = 1000) {
  console.log(`🔍 Fetching SAM.gov opportunities for last ${daysBack} days...`)

  // Calculate date range
  const today = new Date()
  const fromDate = new Date(today.getTime() - (daysBack * 24 * 60 * 60 * 1000))
  
  // Format dates as MM/DD/YYYY (required by SAM.gov API)
  const formatDate = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }

  const postedFrom = formatDate(fromDate)
  const postedTo = formatDate(today)

  console.log(`📅 Date range: ${postedFrom} to ${postedTo}`)

  const url = new URL('https://api.sam.gov/opportunities/v2/search')
  url.searchParams.set('postedFrom', postedFrom)
  url.searchParams.set('postedTo', postedTo)
  url.searchParams.set('limit', limit.toString())
  url.searchParams.set('offset', '0')
  url.searchParams.set('sortBy', '-modifiedDate')

  try {
    console.log(`🌐 Calling SAM.gov API...`)
    const response = await fetch(url.toString(), {
      headers: {
        'X-Api-Key': samApiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'MedContractHub/1.0'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SAM.gov API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log(`✅ Fetched ${data.opportunitiesData?.length || 0} opportunities`)
    
    return data.opportunitiesData || []
  } catch (error) {
    console.error('❌ Error fetching SAM.gov data:', error)
    return []
  }
}

function transformSAMOpportunity(samOpp: SAMOpportunity) {
  const primaryContact = samOpp.pointOfContact?.[0]
  const primaryNaics = samOpp.naics?.[0]
  
  return {
    notice_id: samOpp.noticeId,
    title: samOpp.title,
    description: samOpp.description || null,
    agency: samOpp.agency || 'UNKNOWN',
    sub_agency: samOpp.subAgency || null,
    office: samOpp.office || null,
    posted_date: samOpp.postedDate,
    response_deadline: samOpp.responseDeadLine || samOpp.archiveDate || samOpp.archive?.date || null,
    archive_date: samOpp.archiveDate || samOpp.archive?.date || null,
    naics_code: samOpp.naicsCode || primaryNaics?.code || null,
    naics_description: primaryNaics?.description || null,
    place_of_performance_state: samOpp.placeOfPerformance?.state?.code || null,
    place_of_performance_city: samOpp.placeOfPerformance?.city?.code || null,
    set_aside_type: samOpp.setAsideDescription || null,
    contract_type: samOpp.typeOfContractDescription || null,
    estimated_value_min: null,
    estimated_value_max: null,
    award_date: samOpp.award?.date || null,
    award_amount: samOpp.award?.amount ? parseFloat(samOpp.award.amount.replace(/[^\d.-]/g, '')) : null,
    awardee_name: samOpp.award?.awardee?.name || null,
    awardee_duns: samOpp.award?.awardee?.duns || null,
    status: 'active' as const,
    solicitation_number: samOpp.solicitationNumber || null,
    primary_contact_name: primaryContact?.fullName || null,
    primary_contact_email: primaryContact?.email || null,
    primary_contact_phone: primaryContact?.phone || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

async function bulkInsertOpportunities(opportunities: any[]) {
  console.log(`💾 Inserting ${opportunities.length} opportunities into database...`)
  
  const batchSize = 1000
  let totalInserted = 0
  let totalUpdated = 0
  let totalErrors = 0

  for (let i = 0; i < opportunities.length; i += batchSize) {
    const batch = opportunities.slice(i, i + batchSize)
    
    try {
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(opportunities.length/batchSize)} (${batch.length} records)`)
      
      // Use upsert to handle duplicates
      const { data, error } = await supabase
        .from('opportunities')
        .upsert(batch, { 
          onConflict: 'notice_id',
          ignoreDuplicates: false
        })
        .select('id')

      if (error) {
        console.error(`❌ Batch error:`, error)
        totalErrors += batch.length
      } else {
        const inserted = data?.length || 0
        totalInserted += inserted
        console.log(`✅ Batch completed: ${inserted} records processed`)
      }
    } catch (error) {
      console.error(`❌ Batch processing error:`, error)
      totalErrors += batch.length
    }
  }

  console.log(`\n📊 Bulk insert summary:`)
  console.log(`- Total processed: ${opportunities.length}`)
  console.log(`- Successfully inserted/updated: ${totalInserted}`)
  console.log(`- Errors: ${totalErrors}`)

  return { totalInserted, totalUpdated, totalErrors }
}

async function populateDatabase() {
  try {
    console.log('🚀 Starting SAM.gov database population...\n')

    // Check current count
    const { count: currentCount } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })

    console.log(`📊 Current opportunities in database: ${currentCount}\n`)

    // Fetch opportunities for different time ranges to get good coverage
    const timePeriods = [
      { days: 1, limit: 1000, name: 'Today' },
      { days: 7, limit: 1000, name: 'Last 7 days' },
      { days: 30, limit: 1000, name: 'Last 30 days' }
    ]

    let allOpportunities: any[] = []

    for (const period of timePeriods) {
      console.log(`\n🔄 Fetching ${period.name} (${period.days} days, limit ${period.limit})`)
      const samOpportunities = await fetchSAMGovOpportunities(period.days, period.limit)
      
      if (samOpportunities.length > 0) {
        const transformedOpps = samOpportunities.map(transformSAMOpportunity)
        allOpportunities.push(...transformedOpps)
        console.log(`✅ Added ${transformedOpps.length} opportunities from ${period.name}`)
      }

      // Small delay between API calls to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Remove duplicates based on notice_id
    const uniqueOpportunities = allOpportunities.reduce((acc, current) => {
      const existing = acc.find(item => item.notice_id === current.notice_id)
      if (!existing) {
        acc.push(current)
      }
      return acc
    }, [])

    console.log(`\n🔄 Processing ${uniqueOpportunities.length} unique opportunities...`)

    if (uniqueOpportunities.length > 0) {
      const result = await bulkInsertOpportunities(uniqueOpportunities)
      
      // Check final count
      const { count: finalCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })

      console.log(`\n🎉 Database population completed!`)
      console.log(`📊 Final count: ${finalCount} opportunities (${(finalCount || 0) - (currentCount || 0)} new)`)
      
      return result
    } else {
      console.log('⚠️ No new opportunities found to add')
      return { totalInserted: 0, totalUpdated: 0, totalErrors: 0 }
    }

  } catch (error) {
    console.error('❌ Database population failed:', error)
    throw error
  }
}

// Run the population
populateDatabase()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })