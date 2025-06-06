/**
 * Add test opportunity data to Supabase for development
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Test opportunities data
    const testOpportunities = [
      {
        notice_id: 'VA-2025-001',
        title: 'Medical Equipment Supply Contract',
        description: 'Supply of medical devices and equipment for federal healthcare facilities including surgical instruments, diagnostic equipment, and patient monitoring systems.',
        agency: 'Department of Veterans Affairs',
        posted_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        response_deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        naics_code: '339112',
        naics_description: 'Surgical and Medical Instrument Manufacturing',
        estimated_value_min: 500000,
        estimated_value_max: 1000000,
        place_of_performance_state: 'CA',
        place_of_performance_city: 'Los Angeles',
        contract_type: 'Fixed Price',
        solicitation_number: 'VA-2025-001',
        status: 'active'
      },
      {
        notice_id: 'HHS-2025-002',
        title: 'Healthcare IT Systems Integration',
        description: 'Integration and maintenance of healthcare information systems, EHR systems, and medical data management platforms for federal healthcare facilities.',
        agency: 'Department of Health and Human Services',
        posted_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        response_deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        naics_code: '423450',
        naics_description: 'Medical Equipment and Supplies Merchant Wholesalers',
        estimated_value_min: 250000,
        estimated_value_max: 750000,
        place_of_performance_state: 'TX',
        place_of_performance_city: 'Houston',
        contract_type: 'Time and Materials',
        solicitation_number: 'HHS-2025-002',
        status: 'active'
      },
      {
        notice_id: 'NIH-2025-003',
        title: 'Laboratory Equipment Procurement',
        description: 'Procurement of laboratory testing equipment for research facilities including microscopes, centrifuges, and analytical instruments.',
        agency: 'National Institutes of Health',
        posted_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        response_deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        naics_code: '621999',
        naics_description: 'All Other Miscellaneous Ambulatory Health Care Services',
        estimated_value_min: 100000,
        estimated_value_max: 300000,
        place_of_performance_state: 'MD',
        place_of_performance_city: 'Bethesda',
        contract_type: 'Indefinite Delivery',
        solicitation_number: 'NIH-2025-003',
        status: 'active'
      }
    ]
    
    // Insert test data
    const { data, error } = await supabase
      .from('opportunities')
      .insert(testOpportunities)
      .select()
    
    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test opportunity data added successfully',
      inserted_count: data?.length || 0,
      opportunities: data
    })
    
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}