import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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