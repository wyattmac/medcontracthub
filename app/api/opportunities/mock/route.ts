/**
 * Mock opportunities endpoint for development
 * Returns sample opportunities without requiring database
 */

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '25')
  const offset = parseInt(searchParams.get('offset') || '0')

  // Generate mock opportunities with medical focus
  const mockOpportunities = Array.from({ length: 50 }, (_, i) => ({
    id: `opp-${i + 1}`,
    notice_id: `VA-${2025}-${String(i + 1).padStart(4, '0')}`,
    title: getMockTitle(i),
    agency: getMockAgency(i),
    sub_agency: getMockSubAgency(i),
    office: 'Contracting Office',
    type: i % 3 === 0 ? 'Sources Sought' : i % 3 === 1 ? 'Solicitation' : 'Award Notice',
    status: 'active',
    description: getMockDescription(i),
    posted_date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
    response_deadline: new Date(Date.now() + ((30 - i) * 24 * 60 * 60 * 1000)).toISOString(),
    archive_date: new Date(Date.now() + ((60 - i) * 24 * 60 * 60 * 1000)).toISOString(),
    set_aside_type: i % 4 === 0 ? 'WOSB' : i % 4 === 1 ? 'Small Business' : i % 4 === 2 ? '8(a)' : null,
    naics_code: getMockNAICS(i),
    naics_description: getMockNAICSDescription(i),
    place_of_performance_city: 'Washington',
    place_of_performance_state: 'DC',
    estimated_value_min: (i + 1) * 50000,
    estimated_value_max: (i + 1) * 200000,
    solicitation_number: `SPE2M1-${2025}-R-${String(i + 1).padStart(4, '0')}`,
    primary_contact_name: 'Contracting Officer',
    primary_contact_email: 'contracting@agency.gov',
    primary_contact_phone: '202-555-0100',
    sam_url: `https://sam.gov/opp/${i + 1}`,
    attachments: i % 2 === 0 ? getMockAttachments(i) : [],
    additional_info: {
      resourceLinks: i % 3 === 0 ? getMockResourceLinks(i) : []
    },
    created_at: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
    updated_at: new Date(Date.now() - (i * 12 * 60 * 60 * 1000)).toISOString(),
    matchScore: Math.random(),
    isSaved: false
  }))

  // Paginate results
  const paginatedOpportunities = mockOpportunities.slice(offset, offset + limit)

  return NextResponse.json({
    opportunities: paginatedOpportunities,
    totalCount: mockOpportunities.length,
    total: mockOpportunities.length,
    count: paginatedOpportunities.length,
    hasMore: (offset + limit) < mockOpportunities.length,
    quotaStatus: {
      remaining: 756,
      total: 1000,
      warningThreshold: 200
    }
  })
}

function getMockTitle(index: number): string {
  const titles = [
    'Medical Surgical Supplies and Equipment',
    'Hospital Bed Maintenance and Repair Services',
    'Pharmaceutical Distribution Services',
    'Medical Imaging Equipment',
    'Emergency Medical Supplies',
    'Diagnostic Laboratory Equipment',
    'Personal Protective Equipment (PPE)',
    'Medical Device Calibration Services',
    'Telemedicine Platform Development',
    'Medical Records Management System'
  ]
  return titles[index % titles.length] + ` - ${index + 1}`
}

function getMockAgency(index: number): string {
  const agencies = [
    'Department of Veterans Affairs',
    'Department of Defense',
    'Department of Health and Human Services',
    'Indian Health Service',
    'Centers for Disease Control'
  ]
  return agencies[index % agencies.length]
}

function getMockSubAgency(index: number): string {
  const subAgencies = [
    'Veterans Health Administration',
    'Defense Health Agency',
    'National Institutes of Health',
    'Food and Drug Administration',
    'Strategic National Stockpile'
  ]
  return subAgencies[index % subAgencies.length]
}

function getMockDescription(index: number): string {
  return `This is a ${index % 2 === 0 ? 'competitive' : 'sole source'} procurement for medical supplies and equipment. ` +
    `The agency requires ${index % 3 === 0 ? 'immediate' : 'scheduled'} delivery of FDA-approved medical devices. ` +
    `Vendors must be registered in SAM.gov and have active certifications. ` +
    `This opportunity is ${index % 4 === 0 ? 'set aside for small businesses' : 'open to all vendors'}.`
}

function getMockNAICS(index: number): string {
  const codes = ['339112', '423450', '621999', '541512', '334510']
  return codes[index % codes.length]
}

function getMockNAICSDescription(index: number): string {
  const descriptions = [
    'Surgical and Medical Instrument Manufacturing',
    'Medical Equipment and Supplies Wholesalers',
    'All Other Miscellaneous Ambulatory Health Care Services',
    'Computer Systems Design Services',
    'Electromedical Equipment Manufacturing'
  ]
  return descriptions[index % descriptions.length]
}

function getMockAttachments(index: number): any[] {
  return [
    {
      id: `att-${index}-1`,
      name: `RFP-${index + 1}-Section-L-M.pdf`,
      filename: `RFP-${index + 1}-Section-L-M.pdf`,
      url: `/mock-attachments/opp-${index + 1}/rfp-section-l-m.pdf`,
      type: 'application/pdf',
      size: 1024000
    },
    {
      id: `att-${index}-2`,
      name: `SOW-${index + 1}.pdf`,
      filename: `SOW-${index + 1}.pdf`,
      url: `/mock-attachments/opp-${index + 1}/statement-of-work.pdf`,
      type: 'application/pdf',
      size: 512000
    }
  ]
}

function getMockResourceLinks(index: number): any[] {
  return [
    {
      name: `Technical-Specifications-${index + 1}.pdf`,
      title: 'Technical Specifications',
      url: `/mock-attachments/opp-${index + 1}/technical-specs.pdf`,
      type: 'application/pdf'
    }
  ]
}