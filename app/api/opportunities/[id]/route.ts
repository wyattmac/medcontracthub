import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only import Kafka in production or when explicitly enabled
let eventProducer: any = null
if (process.env.ENABLE_KAFKA === 'true' && process.env.NODE_ENV !== 'development') {
  eventProducer = require('@/lib/events/kafka-producer').eventProducer
}

// Simplified route for development
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('API Route - Fetching opportunity:', id)
    
    // Handle mock opportunities in development
    if (process.env.NODE_ENV === 'development' && id.startsWith('mock-')) {
      const mockOpportunity = {
        id,
        title: 'Medical Equipment and Supplies - VA Hospital System',
        description: 'Comprehensive medical equipment and supplies contract for VA hospital facilities across multiple states. This includes surgical instruments, diagnostic equipment, patient monitoring systems, and consumable medical supplies.',
        naics_code: '423450',
        naics_title: 'Medical, Dental, and Hospital Equipment and Supplies Merchant Wholesalers',
        agency: 'Department of Veterans Affairs',
        office: 'VA Medical Center - Regional Procurement',
        posted_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        response_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        contract_type: 'Firm Fixed Price',
        set_aside_type: 'Total Small Business Set-Aside',
        place_of_performance: 'Multiple Locations - United States',
        estimated_value: 5000000,
        point_of_contact: 'contracting.officer@va.gov',
        solicitation_number: 'VA-2024-MED-SUPPLIES-001',
        status: 'active',
        attachment_url: null,
        sam_url: 'https://sam.gov/opportunities/123456',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        saved_opportunities: [],
        opportunity_analyses: []
      }
      
      return NextResponse.json({ opportunity: mockOpportunity })
    }
    
    // Create Supabase client
    const supabase = await createClient()
    
    console.log('Fetching from database...')
    
    // Fetch opportunity - simplified query without joins first
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Database error:', error)
      
      // Handle "no rows returned" as a 404
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: { message: 'Opportunity not found' } },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { 
          error: { 
            message: `Database error: ${error.message}`,
            code: error.code,
            details: error.details 
          } 
        },
        { status: 500 }
      )
    }
    
    if (!opportunity) {
      return NextResponse.json(
        { error: { message: 'Opportunity not found' } },
        { status: 404 }
      )
    }

    console.log('Opportunity found:', opportunity.id, opportunity.title)
    
    // Add computed fields and default relationships for compatibility
    const enhancedOpportunity = {
      ...opportunity,
      matchScore: 85, // Would normally calculate based on user's NAICS codes
      isSaved: false, // Would check saved_opportunities table
      saved_opportunities: [], // Would be fetched from relationship
      opportunity_analyses: [] // Would be fetched from relationship
    }

    // Publish opportunity viewed event (non-blocking)
    try {
      // Get user info
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const url = new URL(request.url)
        const sessionId = request.headers.get('x-session-id') || `session-${Date.now()}`
        const userAgent = request.headers.get('user-agent') || undefined
        const referrer = request.headers.get('referer') || undefined
        const fromSearch = url.searchParams.get('from_search') || undefined
        
        // Determine view source
        let viewSource: 'SEARCH' | 'DASHBOARD' | 'SAVED' | 'RECOMMENDATION' | 'DIRECT_LINK' = 'DIRECT_LINK'
        if (fromSearch) {
          viewSource = 'SEARCH'
        } else if (referrer?.includes('/saved')) {
          viewSource = 'SAVED'
        } else if (referrer?.includes('/dashboard')) {
          viewSource = 'DASHBOARD'
        }
        
        // Fire and forget - don't await
        if (eventProducer) {
          eventProducer.publishOpportunityViewed(
            user.id,
            opportunity.id,
            {
              title: opportunity.title,
              agency: opportunity.agency,
              naicsCode: opportunity.naics_code,
              setAsideType: opportunity.set_aside_type,
              responseDeadline: opportunity.response_deadline,
            },
            {
              source: viewSource,
              searchQuery: fromSearch,
              referrer,
              sessionId,
              userAgent,
              ipAddress: request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || undefined,
            }
          ).catch(error => {
            console.error('Failed to publish opportunity viewed event:', error)
          })
        }
      }
    } catch (error) {
      // Don't fail the request if event publishing fails
      console.error('Error publishing event:', error)
    }

    return NextResponse.json({ opportunity: enhancedOpportunity })
    
  } catch (error) {
    console.error('Unexpected error in opportunity route:', error)
    return NextResponse.json(
      { 
        error: { 
          message: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    )
  }
}