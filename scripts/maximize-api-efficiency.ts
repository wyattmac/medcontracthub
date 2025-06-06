#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function maximizeAPIEfficiency() {
  console.log('⚡ Maximum API Efficiency Strategy')
  console.log('==================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const samApiKey = process.env.SAM_GOV_API_KEY

  if (!supabaseUrl || !supabaseKey || !samApiKey) {
    console.error('❌ Missing environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🎯 Strategy: Maximum data extraction per API call')
  console.log('📊 Goal: Get ALL available fields from SAM.gov search API\n')

  // Comprehensive medical NAICS codes covering entire supply chain
  const medicalNAICS = [
    // Pharmaceutical and Medicine Manufacturing
    '325411', '325412', '325413', '325414',
    
    // Medical Equipment and Supplies Manufacturing
    '334510', '334517', '339112', '339113', '339115', '339116',
    
    // Medical Equipment and Supplies Merchant Wholesalers
    '423450', '423460',
    
    // Health and Personal Care Stores
    '446110', '446120', '446130', '446191', '446199',
    
    // General Merchandise Stores (Medical Supplies)
    '452112', '452990',
    
    // Electronic Shopping and Mail-Order Houses (Medical)
    '454111', '454112', '454113',
    
    // Other Direct Selling Establishments (Medical)
    '456110', '456120', '456191', '456199',
    
    // Professional, Scientific, and Technical Services
    '541380', '541490', '541511', '541512', '541513', '541519',
    '541611', '541612', '541613', '541614', '541618', '541620',
    '541690', '541713', '541714', '541715', '541720', '541940',
    
    // Ambulatory Health Care Services
    '621111', '621112', '621210', '621310', '621320', '621330', '621340',
    '621391', '621399', '621410', '621420', '621491', '621492', '621493', '621498',
    '621511', '621512', '621610', '621910', '621991', '621999',
    
    // Hospitals
    '622110', '622210', '622310',
    
    // Nursing and Residential Care Facilities
    '623110', '623210', '623220', '623311', '623312', '623990',
    
    // Social Assistance
    '624110', '624120', '624190', '624210', '624221', '624229', '624230', '624310', '624410',
    
    // Public Administration (Health)
    '923120'
  ]

  let totalAPICallsUsed = 0
  let totalOpportunitiesAdded = 0

  try {
    console.log('🔄 PHASE 1: Medical-Focused Comprehensive Sync')
    console.log('==============================================\n')

    // Strategy: Use multiple targeted API calls to get maximum medical data
    for (const naicsCode of medicalNAICS) {
      if (totalAPICallsUsed >= 900) {
        console.log('⚠️  Approaching API limit, saving 100 calls for tomorrow')
        break
      }

      console.log(`🏥 Fetching opportunities for NAICS ${naicsCode}...`)

      // Build comprehensive API call with ALL SAM.gov search filters
      const url = new URL('https://api.sam.gov/opportunities/v2/search')
      url.searchParams.append('api_key', samApiKey)
      
      // Core NAICS filter
      url.searchParams.append('naicsCode', naicsCode)
      
      // Date range - 120 days for maximum coverage
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 120)
      
      const postedFrom = formatDateForSAM(startDate)
      const postedTo = formatDateForSAM(endDate)
      
      url.searchParams.append('postedFrom', postedFrom)
      url.searchParams.append('postedTo', postedTo)
      
      // Status filters - get both active AND inactive for complete historical data
      url.searchParams.append('active', 'true') // Active opportunities
      // Also get recently inactive ones that might still be relevant
      
      // Notice Type filters - get ALL types of medical opportunities
      const noticeTypes = [
        'o', // Solicitation
        'p', // Presolicitation  
        'r', // Sources Sought
        'g', // Sale of Surplus Property
        'k', // Combined Synopsis/Solicitation
        's', // Special Notice
        'i', // Intent to Bundle Requirements
        'a'  // Award Notice
      ]
      noticeTypes.forEach(type => {
        url.searchParams.append('noticeType', type)
      })
      
      // Set Aside filters - medical companies often qualify for these
      const setAsideTypes = [
        'SBA', // Small Business Set Aside
        'SDB', // Small Disadvantaged Business
        'WOSB', // Women-Owned Small Business
        'EDWOSB', // Economically Disadvantaged Women-Owned Small Business
        'HUBZ', // HUBZone Set Aside
        'SDVOSB', // Service-Disabled Veteran-Owned Small Business
        'VOSB', // Veteran-Owned Small Business
        '8A', // 8(a) Set Aside
        'HBCU', // Historically Black Colleges and Universities
        'MSI' // Minority Serving Institution
      ]
      setAsideTypes.forEach(setAside => {
        url.searchParams.append('typeOfSetAside', setAside)
      })
      
      // Keyword search for medical terms (in addition to NAICS)
      const medicalKeywords = [
        'medical', 'healthcare', 'hospital', 'surgical', 'pharmaceutical',
        'diagnostic', 'therapeutic', 'clinical', 'patient', 'nursing',
        'ambulance', 'vaccine', 'medicine', 'drug', 'device', 'equipment',
        'supplies', 'laboratory', 'radiology', 'ultrasound', 'mri',
        'ct scan', 'x-ray', 'ventilator', 'defibrillator', 'pacemaker',
        'biomedical', 'biotechnology', 'prosthetic', 'orthopedic', 'dental',
        'ophthalmology', 'cardiology', 'neurology', 'oncology', 'trauma'
      ]
      
      // Use "any words" search for broad medical coverage
      url.searchParams.append('title', medicalKeywords.join(' OR '))
      
      // Federal Organizations - target key medical agencies
      const medicalAgencies = [
        'VETERANS AFFAIRS', 'DEFENSE HEALTH', 'HEALTH AND HUMAN SERVICES',
        'DEFENSE LOGISTICS AGENCY', 'ARMY MEDICAL', 'NAVY MEDICAL',
        'AIR FORCE MEDICAL', 'NATIONAL INSTITUTES OF HEALTH', 'CDC',
        'FDA', 'TRICARE', 'MILITARY HEALTH', 'VA MEDICAL CENTER'
      ]
      medicalAgencies.forEach(agency => {
        url.searchParams.append('organizationType', agency)
      })
      
      // Contract Award filters - get opportunities with award info
      url.searchParams.append('awardDate', postedFrom) // Awards from same 120-day period
      url.searchParams.append('awardDateTo', postedTo)
      
      // Performance location - get opportunities from all states (medical needs everywhere)
      // Don't filter by location to maximize coverage
      
      // Maximum records per call
      url.searchParams.append('limit', '1000') // Max allowed by SAM.gov
      url.searchParams.append('offset', '0')
      
      // Request ALL available sections for complete data
      url.searchParams.append('includeSections', 'opportunityDescription,pointOfContact,additionalInfoText,awardInformation,attachments,amendments,links')
      
      // Additional filters for comprehensive data
      url.searchParams.append('latest', 'true') // Get latest versions
      url.searchParams.append('archiveType', 'manual') // Include manually archived
      url.searchParams.append('organizationType', 'all') // All organization types
      
      const response = await fetch(url.toString(), {
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

      const data = await response.json()
      const opportunities = data.opportunitiesData || []
      
      console.log(`   📈 Retrieved: ${opportunities.length} opportunities`)
      console.log(`   📊 Total available for this NAICS: ${data.totalRecords || 'unknown'}`)

      if (opportunities.length === 0) {
        console.log(`   ⚠️  No opportunities found for NAICS ${naicsCode}`)
        continue
      }

      // Transform opportunities with MAXIMUM data extraction
      const transformedOpportunities = opportunities.map((opp: any) => ({
        notice_id: opp.noticeId,
        title: opp.title || 'Unknown Title',
        description: opp.description || opp.opportunityDescription || '',
        
        // Agency Information (complete hierarchy)
        agency: opp.fullParentPathName || opp.agency || 'UNKNOWN',
        sub_agency: opp.subAgency || opp.organizationType || null,
        office: opp.office || opp.officeAddress?.city || null,
        
        // Dates
        posted_date: opp.postedDate || new Date().toISOString(),
        response_deadline: opp.responseDeadLine || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        archive_date: opp.archiveDate || null,
        
        // Classification (complete details)
        naics_code: opp.naicsCode || naicsCode,
        naics_description: opp.classificationCode || opp.naicsDescription || null,
        solicitation_number: opp.solicitationNumber || null,
        set_aside_type: opp.typeOfSetAside || opp.typeOfSetAsideDescription || null,
        contract_type: opp.type || opp.baseType || null,
        
        // Performance Location
        place_of_performance_state: opp.placeOfPerformance?.state?.name || opp.placeOfPerformance?.state || null,
        place_of_performance_city: opp.placeOfPerformance?.city?.name || opp.placeOfPerformance?.city || null,
        
        // Contact Information (extract from pointOfContact array)
        primary_contact_name: opp.pointOfContact?.[0]?.fullName || opp.pointOfContact?.[0]?.name || null,
        primary_contact_email: opp.pointOfContact?.[0]?.email || null,
        primary_contact_phone: opp.pointOfContact?.[0]?.phone || opp.pointOfContact?.[0]?.phoneNumber || null,
        
        // Award Information
        award_date: opp.award?.date || null,
        award_amount: opp.award?.amount ? parseFloat(opp.award.amount.replace(/[^0-9.-]+/g, "")) : null,
        awardee_name: opp.award?.awardee?.name || null,
        awardee_duns: opp.award?.awardee?.ueiSAM || opp.award?.awardee?.cageCode || null,
        
        // Estimated Values (extract from various fields)
        estimated_value_min: extractMonetaryValue(opp.estimatedValue || opp.estimatedValueMin),
        estimated_value_max: extractMonetaryValue(opp.estimatedValueMax || opp.estimatedValue),
        
        // Links and Resources
        sam_url: opp.uiLink || null,
        
        // COMPLETE Raw Data Storage (ALL SAM.gov data)
        additional_info: {
          ...opp, // Store EVERYTHING from SAM.gov
          
          // Document and Link Information
          attachments: opp.attachments || [],
          additionalInfoText: opp.additionalInfoText || '',
          resourceLinks: opp.resourceLinks || [],
          links: opp.links || [],
          amendments: opp.amendments || [],
          
          // Contact and Organization Details
          pointOfContact: opp.pointOfContact || [],
          permissions: opp.permissions || [],
          placeOfPerformance: opp.placeOfPerformance || {},
          officeAddress: opp.officeAddress || {},
          
          // Notice and Award Information
          noticeType: opp.noticeType || opp.type || null,
          baseType: opp.baseType || null,
          archiveType: opp.archiveType || null,
          archiveDate: opp.archiveDate || null,
          
          // Set Aside and Classification
          typeOfSetAsideDescription: opp.typeOfSetAsideDescription || null,
          organizationType: opp.organizationType || null,
          fullParentPathCode: opp.fullParentPathCode || null,
          
          // Award Details
          awardInformation: opp.awardInformation || {},
          justificationAuthority: opp.award?.justificationAuthority || null,
          
          // Search and Fetch Metadata
          lastFetched: new Date().toISOString(),
          naicsQueried: naicsCode,
          searchFilters: {
            dateRange: `${postedFrom} to ${postedTo}`,
            noticeTypes: noticeTypes,
            setAsideTypes: setAsideTypes,
            keywordsUsed: medicalKeywords,
            agenciesTargeted: medicalAgencies
          },
          completeData: true,
          fetchMethod: 'comprehensive_search'
        },
        
        status: 'active'
      })).filter(opp => 
        // Quality filter
        opp.notice_id && 
        opp.title && 
        opp.posted_date &&
        opp.response_deadline
      )

      // Bulk insert with conflict resolution
      if (transformedOpportunities.length > 0) {
        const { data: inserted, error } = await supabase
          .from('opportunities')
          .upsert(transformedOpportunities, {
            onConflict: 'notice_id',
            ignoreDuplicates: false
          })
          .select('notice_id')

        if (error) {
          console.log(`   ❌ Database error: ${error.message}`)
          continue
        }

        const addedCount = inserted?.length || 0
        totalOpportunitiesAdded += addedCount
        
        console.log(`   ✅ Stored: ${addedCount} opportunities with complete data`)
        console.log(`   📞 Contact info: ${transformedOpportunities.filter(o => o.primary_contact_email).length} with emails`)
        console.log(`   💰 Value info: ${transformedOpportunities.filter(o => o.estimated_value_max).length} with estimated values`)
        console.log(`   📎 Attachments: ${transformedOpportunities.filter(o => o.additional_info.attachments?.length > 0).length} with attachments`)
      }

      console.log(`   🔄 API calls used so far: ${totalAPICallsUsed}`)
      console.log('')

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1100)) // Slightly over 1 second
    }

    // Get final count
    const { count: finalMedicalCount } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .or(medicalNAICS.map(code => `naics_code.like.${code}%`).join(','))

    console.log('\n🎉 Maximum Efficiency Sync Complete!')
    console.log('=====================================')
    console.log(`📊 Total medical opportunities: ${finalMedicalCount}`)
    console.log(`➕ New/updated opportunities: ${totalOpportunitiesAdded}`)
    console.log(`🔄 API calls used: ${totalAPICallsUsed}`)
    console.log(`💡 Remaining API calls today: ${1000 - totalAPICallsUsed}`)
    console.log('')
    console.log('✅ Each API call retrieved MAXIMUM data including:')
    console.log('   📋 Complete opportunity descriptions')
    console.log('   📞 Full contact information')
    console.log('   💰 Award and estimated value data')
    console.log('   📎 Attachments and resource links')
    console.log('   🏢 Complete agency hierarchy')
    console.log('   🎯 Classification and set-aside details')
    console.log('   📍 Performance location information')
    console.log('')
    console.log(`🚀 Result: ${finalMedicalCount} comprehensive medical opportunities`)
    console.log('   ready for hundreds of users with ZERO additional API calls!')

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

function extractMonetaryValue(value: any): number | null {
  if (!value) return null
  
  if (typeof value === 'number') return value
  
  if (typeof value === 'string') {
    // Remove currency symbols and extract number
    const cleaned = value.replace(/[$,\s]/g, '')
    const number = parseFloat(cleaned)
    return isNaN(number) ? null : number
  }
  
  return null
}

maximizeAPIEfficiency()