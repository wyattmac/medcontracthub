import { Database } from '@/types/database.types'

type Opportunity = Database['public']['Tables']['opportunities']['Row']

export const mockOpportunityWithAttachments: Partial<Opportunity> = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  notice_id: 'TEST-2024-001',
  title: 'Medical Equipment Procurement - Test Opportunity',
  agency: 'Department of Veterans Affairs',
  sub_agency: 'Veterans Health Administration',
  office: 'Strategic Acquisition Center',
  description: 'This is a test opportunity for medical equipment procurement including surgical instruments, diagnostic equipment, and patient monitoring systems.',
  type: 'Solicitation',
  status: 'active',
  posted_date: new Date().toISOString(),
  response_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
  naics_code: '339112',
  naics_description: 'Surgical and Medical Instrument Manufacturing',
  set_aside_type: 'Small Business Set-Aside',
  contract_type: 'Firm Fixed Price',
  place_of_performance_city: 'Washington',
  place_of_performance_state: 'DC',
  place_of_performance_zip: '20420',
  estimated_value_min: 500000,
  estimated_value_max: 2000000,
  solicitation_number: 'VA-2024-TEST-001',
  primary_contact_name: 'John Doe',
  primary_contact_email: 'john.doe@va.gov',
  primary_contact_phone: '202-555-0123',
  attachments: [
    {
      filename: 'RFP-Medical-Equipment.pdf',
      title: 'Request for Proposal - Medical Equipment',
      url: '/mock-attachments/rfp-medical-equipment.pdf',
      type: 'application/pdf',
      size: 2048000
    },
    {
      filename: 'Section-L-M-Requirements.pdf',
      title: 'Section L and M Requirements',
      url: '/mock-attachments/section-l-m-requirements.pdf',
      type: 'application/pdf',
      size: 1024000
    },
    {
      filename: 'Technical-Specifications.pdf',
      title: 'Technical Specifications',
      url: '/mock-attachments/technical-specs.pdf',
      type: 'application/pdf',
      size: 3072000
    }
  ],
  sam_url: 'https://sam.gov/opp/TEST-2024-001/view',
  additional_info: {
    resourceLinks: [
      {
        type: 'RFP Document',
        url: '/mock-attachments/rfp-medical-equipment.pdf'
      },
      {
        type: 'Requirements',
        url: '/mock-attachments/section-l-m-requirements.pdf'
      }
    ]
  }
}

export const mockOpportunityWithoutAttachments: Partial<Opportunity> = {
  id: '223e4567-e89b-12d3-a456-426614174001',
  notice_id: 'TEST-2024-002',
  title: 'Medical Supplies - No Attachments',
  agency: 'Department of Health and Human Services',
  sub_agency: 'Centers for Disease Control and Prevention',
  description: 'Basic medical supplies procurement without attachments.',
  type: 'Sources Sought',
  status: 'active',
  posted_date: new Date().toISOString(),
  response_deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
  naics_code: '339113',
  naics_description: 'Surgical Appliance and Supplies Manufacturing',
  attachments: [],
  sam_url: 'https://sam.gov/opp/TEST-2024-002/view'
}

export const mockExpiredOpportunity: Partial<Opportunity> = {
  id: '323e4567-e89b-12d3-a456-426614174002',
  notice_id: 'TEST-2023-001',
  title: 'Expired Medical Equipment RFP',
  agency: 'Department of Defense',
  sub_agency: 'Defense Health Agency',
  description: 'This opportunity has expired.',
  type: 'Solicitation',
  status: 'inactive',
  posted_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
  response_deadline: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
  naics_code: '339112',
  attachments: [],
  sam_url: 'https://sam.gov/opp/TEST-2023-001/view'
}

export const createMockOpportunity = (overrides: Partial<Opportunity> = {}): Partial<Opportunity> => {
  return {
    ...mockOpportunityWithAttachments,
    ...overrides,
    id: overrides.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    notice_id: overrides.notice_id || `TEST-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}