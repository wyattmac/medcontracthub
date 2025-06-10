import { z } from 'zod'
import { 
  naicsSchema, 
  dateSchema, 
  valueRangeSchema,
  opportunityStatusSchema,
  proposalStatusSchema,
} from './shared-schemas'
import { US_STATE_CODES, SET_ASIDE_TYPES, CONTRACT_TYPES } from './constants'

// Medical industry NAICS codes (from lib/constants/medical-naics.ts)
const MEDICAL_NAICS_CODES = [
  '339112', // Surgical and Medical Instrument Manufacturing
  '339113', // Surgical Appliance and Supplies Manufacturing
  '339114', // Dental Equipment and Supplies Manufacturing
  '339115', // Ophthalmic Goods Manufacturing
  '339116', // Dental Laboratories
  '423450', // Medical Equipment Merchant Wholesalers
  '446110', // Pharmacies and Drug Stores
  '621610', // Home Health Care Services
  '622110', // General Medical and Surgical Hospitals
  '622210', // Psychiatric and Substance Abuse Hospitals
  '622310', // Specialty Hospitals
  '623110', // Nursing Care Facilities
  '623210', // Residential Intellectual Disability Facilities
  '623311', // Continuing Care Retirement Communities
  '339999', // All Other Miscellaneous Manufacturing (Medical-related)
]

// Validate NAICS code is in medical industry
export const medicalNaicsSchema = naicsSchema.refine(
  (code) => MEDICAL_NAICS_CODES.includes(code),
  { message: 'NAICS code must be in the medical industry' }
)

// Validate array of NAICS codes contains at least one medical code
export const medicalNaicsArraySchema = z
  .array(naicsSchema)
  .refine(
    (codes) => codes.some((code) => MEDICAL_NAICS_CODES.includes(code)),
    { message: 'At least one NAICS code must be in the medical industry' }
  )

// Opportunity validation with business rules
export const opportunityBusinessSchema = z.object({
  noticeId: z.string().regex(/^[A-Z0-9-]+$/, 'Invalid notice ID format'),
  title: z.string().min(10, 'Title too short').max(500, 'Title too long'),
  agency: z.string().min(1, 'Agency is required'),
  department: z.string().optional(),
  postedDate: dateSchema,
  responseDeadline: dateSchema,
  naicsCodes: z.array(naicsSchema).min(1, 'At least one NAICS code required'),
  setAsideTypes: z.array(z.enum(SET_ASIDE_TYPES as readonly [string, ...string[]])),
  contractType: z.enum(Object.values(CONTRACT_TYPES) as readonly [string, ...string[]]),
  valueAmount: valueRangeSchema.optional(),
  placeOfPerformance: z.object({
    state: z.enum(US_STATE_CODES as readonly [string, ...string[]]),
    city: z.string().optional(),
  }).optional(),
  description: z.string().min(50, 'Description too short').max(5000, 'Description too long'),
  status: opportunityStatusSchema,
}).refine((data) => {
  // Response deadline must be after posted date
  const posted = new Date(data.postedDate)
  const deadline = new Date(data.responseDeadline)
  return deadline > posted
}, {
  message: 'Response deadline must be after posted date',
  path: ['responseDeadline']
}).refine((data) => {
  // Active opportunities must have future deadline
  if (data.status === 'active') {
    const deadline = new Date(data.responseDeadline)
    return deadline > new Date()
  }
  return true
}, {
  message: 'Active opportunities must have future response deadline',
  path: ['status']
})

// Company profile validation with business rules
export const companyBusinessSchema = z.object({
  name: z.string().min(2, 'Company name too short').max(255, 'Company name too long'),
  dunsNumber: z.string().regex(/^\d{9}$/, 'DUNS must be 9 digits').optional(),
  cageCode: z.string().regex(/^[A-Z0-9]{5}$/, 'CAGE must be 5 characters').optional(),
  naicsCodes: medicalNaicsArraySchema,
  certifications: z.array(z.string()),
  samRegistrationDate: dateSchema.optional(),
  samExpirationDate: dateSchema.optional(),
}).refine((data) => {
  // If SAM registration exists, expiration must be after registration
  if (data.samRegistrationDate && data.samExpirationDate) {
    const reg = new Date(data.samRegistrationDate)
    const exp = new Date(data.samExpirationDate)
    return exp > reg
  }
  return true
}, {
  message: 'SAM expiration must be after registration date',
  path: ['samExpirationDate']
}).refine((data) => {
  // Either DUNS or CAGE code should be present for government contractors
  return data.dunsNumber || data.cageCode
}, {
  message: 'Either DUNS number or CAGE code is required for government contractors'
})

// Proposal validation with business rules
export const proposalBusinessSchema = z.object({
  opportunityId: z.string().uuid('Invalid opportunity ID'),
  title: z.string().min(10).max(200),
  status: proposalStatusSchema,
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    wordCount: z.number().min(0),
    required: z.boolean(),
  })),
  submittedAt: dateSchema.optional(),
  dueDate: dateSchema,
}).refine((data) => {
  // Submitted proposals must have submittedAt date
  if (data.status === 'submitted' || data.status === 'under_review' || 
      data.status === 'awarded' || data.status === 'rejected') {
    return !!data.submittedAt
  }
  return true
}, {
  message: 'Submitted proposals must have submission date',
  path: ['submittedAt']
}).refine((data) => {
  // All required sections must have content for non-draft proposals
  if (data.status !== 'draft') {
    const requiredSections = data.sections.filter(s => s.required)
    return requiredSections.every(s => s.content && s.content.trim().length > 0)
  }
  return true
}, {
  message: 'All required sections must be completed before submission',
  path: ['sections']
})

// Billing/Subscription validation
export const subscriptionBusinessSchema = z.object({
  planId: z.enum(['starter', 'pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'annual']),
  paymentMethodId: z.string().optional(),
}).refine((data) => {
  // Pro and Enterprise plans require payment method
  if (data.planId !== 'starter' && !data.paymentMethodId) {
    return false
  }
  return true
}, {
  message: 'Payment method required for Pro and Enterprise plans',
  path: ['paymentMethodId']
})

// Helper functions for business rule validation

export function isValidNAICS(codes: string[]): boolean {
  return codes.every(code => /^\d{6}$/.test(code))
}

export function isMedicalNAICS(code: string): boolean {
  return MEDICAL_NAICS_CODES.includes(code)
}

export function hasSetAsideMatch(
  opportunitySetAsides: string[],
  companyCertifications: string[]
): boolean {
  // Map certifications to corresponding set-aside types
  const certToSetAside: Record<string, string[]> = {
    'Small Business': ['Small Business', 'Total Small Business'],
    'WOSB': ['Women-Owned Small Business (WOSB)', 'Total Small Business'],
    'EDWOSB': ['Economically Disadvantaged WOSB (EDWOSB)', 'Women-Owned Small Business (WOSB)', 'Total Small Business'],
    'HUBZone': ['HUBZone Small Business', 'Total Small Business'],
    'SDVOSB': ['Service-Disabled Veteran-Owned Small Business (SDVOSB)', 'Veteran-Owned Small Business (VOSB)', 'Total Small Business'],
    'VOSB': ['Veteran-Owned Small Business (VOSB)', 'Total Small Business'],
    '8(a)': ['8(a) Business Development', 'Total Small Business'],
    'Native American': ['Native American Owned', 'Total Small Business'],
  }

  return companyCertifications.some(cert => {
    const eligibleSetAsides = certToSetAside[cert] || []
    return eligibleSetAsides.some(setAside => opportunitySetAsides.includes(setAside))
  })
}

export function calculateResponseDaysRemaining(deadline: string | Date): number {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline
  const now = new Date()
  const diffTime = deadlineDate.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function isOpportunityExpiringSoon(deadline: string | Date): boolean {
  const daysRemaining = calculateResponseDaysRemaining(deadline)
  return daysRemaining >= 0 && daysRemaining <= 7
}