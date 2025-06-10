/**
 * Mock Database Data
 * 
 * Provides sample data for all entity types
 * Used across test suites for consistent test data
 */

import { Database } from '@/types/database.types'

type Tables = Database['public']['Tables']

/**
 * Sample Companies
 */
export const mockCompanies: Tables['companies']['Row'][] = [
  {
    id: 'company-1',
    name: 'MedTech Solutions Inc.',
    duns_number: '123456789',
    cage_code: 'ABC123',
    ein: '12-3456789',
    description: 'Leading medical technology provider',
    address_line1: '123 Medical Way',
    address_line2: 'Suite 100',
    city: 'Boston',
    state: 'MA',
    zip_code: '02101',
    phone: '(555) 123-4567',
    website: 'https://medtechsolutions.com',
    certifications: ['ISO 9001', 'ISO 13485'],
    naics_codes: ['339112', '339113'],
    sam_registration_date: '2023-01-15',
    sam_expiration_date: '2024-01-15',
    subscription_plan: 'professional',
    subscription_status: 'active',
    stripe_customer_id: 'cus_test123',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  },
  {
    id: 'company-2',
    name: 'Healthcare Supplies Co.',
    duns_number: '987654321',
    cage_code: 'XYZ789',
    ein: '98-7654321',
    description: 'Medical supplies distributor',
    address_line1: '456 Supply Street',
    address_line2: null,
    city: 'Chicago',
    state: 'IL',
    zip_code: '60601',
    phone: '(555) 987-6543',
    website: 'https://healthcaresupplies.com',
    certifications: ['WOSB', 'EDWOSB'],
    naics_codes: ['423450', '423490'],
    sam_registration_date: '2023-02-01',
    sam_expiration_date: '2024-02-01',
    subscription_plan: 'starter',
    subscription_status: 'trialing',
    stripe_customer_id: null,
    created_at: '2023-02-01T00:00:00Z',
    updated_at: '2023-02-01T00:00:00Z'
  }
]

/**
 * Sample Users/Profiles
 */
export const mockProfiles: Tables['profiles']['Row'][] = [
  {
    id: 'user-1',
    email: 'john.doe@medtechsolutions.com',
    full_name: 'John Doe',
    avatar_url: 'https://example.com/avatar1.jpg',
    company_id: 'company-1',
    role: 'owner',
    title: 'CEO',
    department: 'Executive',
    phone: '(555) 123-4567',
    preferences: {
      email_notifications: {
        opportunity_matches: true,
        deadline_reminders: true,
        weekly_summary: true,
        proposal_updates: true
      },
      ui_preferences: {
        theme: 'light',
        compact_view: false,
        default_opportunity_view: 'list'
      },
      search_preferences: {
        default_naics_codes: ['339112', '339113'],
        default_set_asides: [],
        default_agencies: [],
        saved_searches: []
      }
    },
    onboarding_completed: true,
    onboarding_completed_at: '2023-01-01T12:00:00Z',
    last_activity_at: '2024-01-10T15:30:00Z',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-01-10T15:30:00Z'
  },
  {
    id: 'user-2',
    email: 'jane.smith@medtechsolutions.com',
    full_name: 'Jane Smith',
    avatar_url: null,
    company_id: 'company-1',
    role: 'admin',
    title: 'VP of Sales',
    department: 'Sales',
    phone: '(555) 123-4568',
    preferences: {
      email_notifications: {
        opportunity_matches: true,
        deadline_reminders: false,
        weekly_summary: true,
        proposal_updates: true
      },
      ui_preferences: {
        theme: 'dark',
        compact_view: true,
        default_opportunity_view: 'grid'
      },
      search_preferences: {
        default_naics_codes: ['339112'],
        default_set_asides: ['WOSB'],
        default_agencies: ['VA', 'DOD'],
        saved_searches: [
          {
            name: 'High Value Medical',
            params: { minValue: 100000, naicsCodes: ['339112'] }
          }
        ]
      }
    },
    onboarding_completed: true,
    onboarding_completed_at: '2023-01-02T10:00:00Z',
    last_activity_at: '2024-01-10T14:00:00Z',
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2024-01-10T14:00:00Z'
  }
]

/**
 * Sample Opportunities
 */
export const mockOpportunities: Tables['opportunities']['Row'][] = [
  {
    id: 'opp-1',
    notice_id: 'VA-24-00001',
    title: 'Medical Equipment Supply Contract',
    solicitation_number: 'VA-24-MEDSUP-001',
    agency: 'Department of Veterans Affairs',
    sub_agency: 'Veterans Health Administration',
    office: 'Strategic Acquisition Center',
    posted_date: '2024-01-01',
    response_deadline: '2024-02-01',
    archive_date: '2024-03-01',
    notice_type: 'Solicitation',
    contract_type: 'Firm Fixed Price',
    set_aside_codes: ['SBA', 'WOSB'],
    naics_codes: ['339112', '339113'],
    description: 'Procurement of medical equipment and supplies for VA hospitals',
    primary_poc: {
      name: 'John Contract Officer',
      email: 'john.officer@va.gov',
      phone: '(555) 111-2222'
    },
    secondary_poc: null,
    place_of_performance: {
      city: 'Washington',
      state: 'DC',
      zip: '20001'
    },
    estimated_value_min: 100000,
    estimated_value_max: 500000,
    classification_code: 'PSC-6515',
    active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'opp-2',
    notice_id: 'DOD-24-00002',
    title: 'Pharmaceutical Distribution Services',
    solicitation_number: 'DOD-24-PHARMA-002',
    agency: 'Department of Defense',
    sub_agency: 'Defense Health Agency',
    office: 'DHA Contracting Office',
    posted_date: '2024-01-05',
    response_deadline: '2024-02-15',
    archive_date: '2024-03-15',
    notice_type: 'Sources Sought',
    contract_type: 'IDIQ',
    set_aside_codes: [],
    naics_codes: ['423450', '424210'],
    description: 'Multi-year IDIQ for pharmaceutical distribution to military medical facilities',
    primary_poc: {
      name: 'Jane Contracting Specialist',
      email: 'jane.specialist@dha.mil',
      phone: '(555) 333-4444'
    },
    secondary_poc: {
      name: 'Bob Backup Officer',
      email: 'bob.backup@dha.mil',
      phone: '(555) 333-4445'
    },
    place_of_performance: {
      city: 'San Antonio',
      state: 'TX',
      zip: '78234'
    },
    estimated_value_min: 1000000,
    estimated_value_max: 5000000,
    classification_code: 'PSC-6505',
    active: true,
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-05T00:00:00Z'
  },
  {
    id: 'opp-3',
    notice_id: 'HHS-24-00003',
    title: 'Medical Laboratory Services',
    solicitation_number: 'HHS-24-LAB-003',
    agency: 'Department of Health and Human Services',
    sub_agency: 'Centers for Disease Control',
    office: 'CDC Procurement Office',
    posted_date: '2023-12-15',
    response_deadline: '2024-01-15',
    archive_date: '2024-02-15',
    notice_type: 'Award Notice',
    contract_type: 'Cost Plus Fixed Fee',
    set_aside_codes: ['8A'],
    naics_codes: ['621511', '621512'],
    description: 'Laboratory testing services for public health initiatives',
    primary_poc: {
      name: 'Alice Lab Manager',
      email: 'alice.manager@cdc.gov',
      phone: '(555) 666-7777'
    },
    secondary_poc: null,
    place_of_performance: {
      city: 'Atlanta',
      state: 'GA',
      zip: '30333'
    },
    estimated_value_min: 500000,
    estimated_value_max: 2000000,
    classification_code: 'PSC-8040',
    active: false, // Expired
    created_at: '2023-12-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z'
  }
]

/**
 * Sample Saved Opportunities
 */
export const mockSavedOpportunities: Tables['saved_opportunities']['Row'][] = [
  {
    id: 'saved-1',
    user_id: 'user-1',
    company_id: 'company-1',
    opportunity_id: 'opp-1',
    notes: 'Great fit for our medical equipment line',
    reminder_date: '2024-01-25',
    saved_at: '2024-01-02T10:00:00Z',
    created_at: '2024-01-02T10:00:00Z',
    updated_at: '2024-01-02T10:00:00Z'
  },
  {
    id: 'saved-2',
    user_id: 'user-2',
    company_id: 'company-1',
    opportunity_id: 'opp-2',
    notes: 'Potential partnership opportunity with pharma division',
    reminder_date: '2024-02-01',
    saved_at: '2024-01-06T14:00:00Z',
    created_at: '2024-01-06T14:00:00Z',
    updated_at: '2024-01-06T14:00:00Z'
  }
]

/**
 * Sample Proposals
 */
export const mockProposals: Tables['proposals']['Row'][] = [
  {
    id: 'proposal-1',
    user_id: 'user-1',
    company_id: 'company-1',
    opportunity_id: 'opp-1',
    title: 'Medical Equipment Supply Proposal - VA Contract',
    solicitation_number: 'VA-24-MEDSUP-001',
    submission_deadline: '2024-02-01',
    actual_submission_date: null,
    total_proposed_price: 350000,
    win_probability: 75,
    status: 'draft',
    proposal_summary: 'Comprehensive medical equipment supply solution for VA hospitals',
    notes: 'Focus on our ISO certifications and past performance',
    tags: ['medical-equipment', 'va', 'high-priority'],
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z'
  },
  {
    id: 'proposal-2',
    user_id: 'user-2',
    company_id: 'company-1',
    opportunity_id: null,
    title: 'Generic Medical Supplies Capability Statement',
    solicitation_number: null,
    submission_deadline: null,
    actual_submission_date: null,
    total_proposed_price: null,
    win_probability: null,
    status: 'draft',
    proposal_summary: 'General capability statement for medical supplies',
    notes: 'Template for quick response to RFIs',
    tags: ['template', 'capability-statement'],
    created_at: '2024-01-08T00:00:00Z',
    updated_at: '2024-01-08T00:00:00Z'
  }
]

/**
 * Sample Proposal Sections
 */
export const mockProposalSections: Tables['proposal_sections']['Row'][] = [
  {
    id: 'section-1',
    proposal_id: 'proposal-1',
    section_type: 'technical',
    title: 'Technical Approach',
    content: 'Our technical approach leverages 20 years of experience...',
    display_order: 1,
    is_required: true,
    max_pages: 10,
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z'
  },
  {
    id: 'section-2',
    proposal_id: 'proposal-1',
    section_type: 'past_performance',
    title: 'Past Performance',
    content: 'Recent relevant contracts include...',
    display_order: 2,
    is_required: true,
    max_pages: 5,
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z'
  }
]

/**
 * Sample Contract Documents
 */
export const mockContractDocuments: Tables['contract_documents']['Row'][] = [
  {
    id: 'doc-1',
    user_id: 'user-1',
    company_id: 'company-1',
    opportunity_id: 'opp-1',
    document_name: 'VA-24-MEDSUP-001-RFP.pdf',
    document_type: 'RFP',
    file_size: 2048000,
    file_url: 'https://storage.example.com/docs/doc-1.pdf',
    sam_gov_url: 'https://sam.gov/opportunities/doc-1',
    processed: true,
    extracted_text: 'Request for Proposal for Medical Equipment...',
    metadata: {
      pages: 45,
      extractedDate: '2024-01-02T00:00:00Z'
    },
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  }
]

/**
 * Sample Opportunity Analyses
 */
export const mockOpportunityAnalyses: Tables['opportunity_analyses']['Row'][] = [
  {
    id: 'analysis-1',
    user_id: 'user-1',
    company_id: 'company-1',
    opportunity_id: 'opp-1',
    score: 85,
    strengths: [
      'Strong match with NAICS codes',
      'Previous VA contract experience',
      'WOSB set-aside eligible'
    ],
    weaknesses: [
      'Tight submission deadline',
      'Strong competition expected'
    ],
    recommendations: [
      'Partner with logistics provider',
      'Highlight ISO certifications',
      'Submit questions by Jan 15'
    ],
    competitor_analysis: {
      expectedCompetitors: 5,
      mainCompetitors: ['CompetitorA', 'CompetitorB']
    },
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z'
  }
]

/**
 * Test data factory functions
 */
export class TestDataFactory {
  static createCompany(overrides?: Partial<Tables['companies']['Row']>): Tables['companies']['Row'] {
    return {
      ...mockCompanies[0],
      id: `company-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    }
  }

  static createUser(overrides?: Partial<Tables['profiles']['Row']>): Tables['profiles']['Row'] {
    return {
      ...mockProfiles[0],
      id: `user-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    }
  }

  static createOpportunity(overrides?: Partial<Tables['opportunities']['Row']>): Tables['opportunities']['Row'] {
    return {
      ...mockOpportunities[0],
      id: `opp-${Date.now()}`,
      notice_id: `TEST-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    }
  }

  static createProposal(overrides?: Partial<Tables['proposals']['Row']>): Tables['proposals']['Row'] {
    return {
      ...mockProposals[0],
      id: `proposal-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    }
  }

  static createBulkOpportunities(count: number): Tables['opportunities']['Row'][] {
    return Array.from({ length: count }, (_, i) => 
      this.createOpportunity({
        id: `opp-bulk-${i}`,
        notice_id: `BULK-${Date.now()}-${i}`,
        title: `Bulk Opportunity ${i}`
      })
    )
  }
}