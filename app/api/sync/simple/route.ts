import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SAMApiClient } from '@/lib/sam-gov/client'
import { getSAMQuotaManager, CallPriority, executeWithPriority } from '@/lib/sam-gov/quota-manager'
import { getSAMCacheStrategy, withCache } from '@/lib/sam-gov/cache-strategy'

// Create service role client to bypass RLS
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simple sync endpoint for testing
export async function POST(request: Request) {
  try {
    console.log('Simple sync endpoint called')
    
    // Check quota before syncing
    const quotaManager = getSAMQuotaManager()
    const quotaStatus = await quotaManager.getQuotaStatus()
    
    console.log('Current quota status:', {
      daily: quotaStatus.daily,
      hourly: quotaStatus.hourly
    })
    
    // Don't sync if quota is low
    if (quotaStatus.daily.remaining < 100) {
      return NextResponse.json({
        error: 'API quota too low for sync operation',
        quotaStatus: quotaStatus.daily,
        message: `Only ${quotaStatus.daily.remaining} API calls remaining today. Sync requires ~50-250 calls.`
      }, { status: 429 })
    }
    
    // Get API key
    const apiKey = process.env.SAM_GOV_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SAM_GOV_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Create SAM.gov client directly
    const samClient = new SAMApiClient({
      baseUrl: 'https://api.sam.gov',
      apiKey,
      timeout: 30000
    })

    // Test the connection first
    console.log('Testing SAM.gov API connection...')
    const testParams = {
      limit: 1,
      offset: 0,
      active: 'true' as const
    }

    try {
      const testResponse = await samClient.getOpportunities(testParams)
      console.log('SAM.gov API test successful:', {
        totalRecords: testResponse.totalRecords,
        hasData: !!testResponse.opportunitiesData
      })
    } catch (apiError: any) {
      console.error('SAM.gov API test failed:', apiError)
      return NextResponse.json(
        { 
          error: 'SAM.gov API connection failed',
          details: apiError.message,
          status: apiError.status
        },
        { status: 500 }
      )
    }

    // Use service role client for database operations

    // Fetch opportunities with medical NAICS codes
    console.log('Fetching medical opportunities...')
    const medicalNaicsCodes = ['339112', '339113', '339114', '423450', '621999']
    
    let totalSynced = 0
    const errors: any[] = []

    for (const naicsCode of medicalNaicsCodes) {
      try {
        console.log(`Fetching opportunities for NAICS ${naicsCode}...`)
        
        const response = await samClient.getOpportunities({
          limit: 50, // Get more opportunities
          offset: 0,
          active: 'true' as const,
          naicsCode: naicsCode
        })

        if (response.opportunitiesData && response.opportunitiesData.length > 0) {
          console.log(`Found ${response.opportunitiesData.length} opportunities for NAICS ${naicsCode}`)
          
          // Transform and insert opportunities
          for (const opp of response.opportunitiesData) {
            try {
              const transformedOpp = {
                id: opp.noticeId,
                title: opp.title || 'Untitled Opportunity',
                description: opp.description || '',
                notice_id: opp.noticeId,
                solicitation_number: opp.solicitationNumber || opp.noticeId,
                agency: opp.fullParentPathName || '',
                sub_agency: '',
                office: '',
                posted_date: opp.postedDate,
                response_deadline: opp.responseDeadLine || opp.archiveDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                archive_date: opp.archiveDate,
                set_aside_type: opp.typeOfSetAside,
                contract_type: opp.type,
                naics_code: opp.naicsCode || naicsCode,
                naics_description: '',
                primary_contact_name: opp.pointOfContact?.[0]?.title,
                primary_contact_email: opp.pointOfContact?.[0]?.email,
                primary_contact_phone: opp.pointOfContact?.[0]?.phone,
                place_of_performance_city: opp.placeOfPerformance?.city?.name,
                place_of_performance_state: opp.placeOfPerformance?.state?.code,
                status: opp.active === 'Yes' ? 'active' : 'inactive',
                sam_url: `https://sam.gov/opp/${opp.noticeId}`
              }

              const { error } = await serviceSupabase
                .from('opportunities')
                .upsert(transformedOpp, {
                  onConflict: 'id'
                })

              if (error) {
                console.error(`Failed to insert opportunity ${opp.noticeId}:`, error)
                errors.push({ id: opp.noticeId, error: error.message })
              } else {
                totalSynced++
              }
            } catch (transformError) {
              console.error(`Failed to transform opportunity ${opp.noticeId}:`, transformError)
              errors.push({ id: opp.noticeId, error: 'Transform failed' })
            }
          }
        }
      } catch (naicsError) {
        console.error(`Failed to fetch NAICS ${naicsCode}:`, naicsError)
        errors.push({ naics: naicsCode, error: 'Fetch failed' })
      }
    }

    console.log(`Sync completed. Total synced: ${totalSynced}`)

    return NextResponse.json({
      success: true,
      totalSynced,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully synced ${totalSynced} opportunities`
    })

  } catch (error) {
    console.error('Sync failed:', error)
    return NextResponse.json(
      { 
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}