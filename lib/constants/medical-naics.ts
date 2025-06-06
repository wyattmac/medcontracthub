/**
 * Medical and Healthcare Industry NAICS Codes
 * Comprehensive list for MedContractHub opportunity matching
 */

export interface MedicalNAICSCode {
  code: string
  title: string
  category: 'manufacturing' | 'wholesale' | 'retail' | 'services' | 'healthcare' | 'research' | 'administrative' | 'public'
  level: 2 | 3 | 4 | 5 | 6
  parent?: string
}

export const MEDICAL_NAICS_CODES: MedicalNAICSCode[] = [
  // Manufacturing - Pharmaceutical and Medical
  { code: '31-33', title: 'Manufacturing', category: 'manufacturing', level: 2 },
  { code: '325', title: 'Chemical Manufacturing', category: 'manufacturing', level: 3, parent: '31-33' },
  { code: '3254', title: 'Pharmaceutical and Medicine Manufacturing', category: 'manufacturing', level: 4, parent: '325' },
  { code: '325411', title: 'Medicinal and Botanical Manufacturing', category: 'manufacturing', level: 6, parent: '3254' },
  { code: '325412', title: 'Pharmaceutical Preparation Manufacturing', category: 'manufacturing', level: 6, parent: '3254' },
  { code: '325413', title: 'In-Vitro Diagnostic Substance Manufacturing', category: 'manufacturing', level: 6, parent: '3254' },
  { code: '325414', title: 'Biological Product (except Diagnostic) Manufacturing', category: 'manufacturing', level: 6, parent: '3254' },
  
  // Medical Equipment Manufacturing
  { code: '339', title: 'Miscellaneous Manufacturing', category: 'manufacturing', level: 3, parent: '31-33' },
  { code: '3391', title: 'Medical Equipment and Supplies Manufacturing', category: 'manufacturing', level: 4, parent: '339' },
  { code: '33911', title: 'Medical Equipment and Supplies Manufacturing', category: 'manufacturing', level: 5, parent: '3391' },
  { code: '339112', title: 'Surgical and Medical Instrument Manufacturing', category: 'manufacturing', level: 6, parent: '33911' },
  { code: '339113', title: 'Surgical Appliance and Supplies Manufacturing', category: 'manufacturing', level: 6, parent: '33911' },
  { code: '339114', title: 'Dental Equipment and Supplies Manufacturing', category: 'manufacturing', level: 6, parent: '33911' },
  { code: '339115', title: 'Ophthalmic Goods Manufacturing', category: 'manufacturing', level: 6, parent: '33911' },
  { code: '339116', title: 'Dental Laboratories', category: 'manufacturing', level: 6, parent: '33911' },
  
  // Wholesale Trade - Medical
  { code: '42', title: 'Wholesale Trade', category: 'wholesale', level: 2 },
  { code: '423', title: 'Merchant Wholesalers, Durable Goods', category: 'wholesale', level: 3, parent: '42' },
  { code: '4234', title: 'Professional and Commercial Equipment and Supplies Merchant Wholesalers', category: 'wholesale', level: 4, parent: '423' },
  { code: '423450', title: 'Medical, Dental, and Hospital Equipment and Supplies Merchant Wholesalers', category: 'wholesale', level: 6, parent: '4234' },
  { code: '423460', title: 'Ophthalmic Goods Merchant Wholesalers', category: 'wholesale', level: 6, parent: '4234' },
  
  // Wholesale Trade - Drugs
  { code: '424', title: 'Merchant Wholesalers, Nondurable Goods', category: 'wholesale', level: 3, parent: '42' },
  { code: '4242', title: 'Drugs and Druggists\' Sundries Merchant Wholesalers', category: 'wholesale', level: 4, parent: '424' },
  { code: '424210', title: 'Drugs and Druggists\' Sundries Merchant Wholesalers', category: 'wholesale', level: 6, parent: '4242' },
  
  // Retail - Health and Personal Care
  { code: '456', title: 'Health and Personal Care Retailers', category: 'retail', level: 3, parent: '44-45' },
  { code: '4561', title: 'Health and Personal Care Retailers', category: 'retail', level: 4, parent: '456' },
  { code: '456110', title: 'Pharmacies and Drug Retailers', category: 'retail', level: 6, parent: '4561' },
  { code: '456120', title: 'Cosmetics, Beauty Supplies, and Perfume Retailers', category: 'retail', level: 6, parent: '4561' },
  { code: '456130', title: 'Optical Goods Retailers', category: 'retail', level: 6, parent: '4561' },
  { code: '45619', title: 'Other Health and Personal Care Retailers', category: 'retail', level: 5, parent: '4561' },
  { code: '456191', title: 'Food (Health) Supplement Retailers', category: 'retail', level: 6, parent: '45619' },
  { code: '456199', title: 'All Other Health and Personal Care Retailers', category: 'retail', level: 6, parent: '45619' },
  
  // Equipment Rental
  { code: '53', title: 'Real Estate and Rental and Leasing', category: 'services', level: 2 },
  { code: '532', title: 'Rental and Leasing Services', category: 'services', level: 3, parent: '53' },
  { code: '5322', title: 'Consumer Goods Rental', category: 'services', level: 4, parent: '532' },
  { code: '53228', title: 'Other Consumer Goods Rental', category: 'services', level: 5, parent: '5322' },
  { code: '532283', title: 'Home Health Equipment Rental', category: 'services', level: 6, parent: '53228' },
  
  // Professional and Technical Services
  { code: '54', title: 'Professional, Scientific, and Technical Services', category: 'services', level: 2 },
  { code: '541', title: 'Professional, Scientific, and Technical Services', category: 'services', level: 3, parent: '54' },
  { code: '5413', title: 'Architectural, Engineering, and Related Services', category: 'services', level: 4, parent: '541' },
  { code: '541380', title: 'Testing Laboratories and Services', category: 'services', level: 6, parent: '5413' },
  
  // Research and Development
  { code: '5417', title: 'Scientific Research and Development Services', category: 'research', level: 4, parent: '541' },
  { code: '54171', title: 'Research and Development in the Physical, Engineering, and Life Sciences', category: 'research', level: 5, parent: '5417' },
  { code: '541713', title: 'Research and Development in Nanotechnology', category: 'research', level: 6, parent: '54171' },
  { code: '541714', title: 'Research and Development in Biotechnology (except Nanobiotechnology)', category: 'research', level: 6, parent: '54171' },
  { code: '541715', title: 'Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology)', category: 'research', level: 6, parent: '54171' },
  
  // Veterinary Services
  { code: '5419', title: 'Other Professional, Scientific, and Technical Services', category: 'services', level: 4, parent: '541' },
  { code: '541940', title: 'Veterinary Services', category: 'services', level: 6, parent: '5419' },
  
  // Administrative and Support Services
  { code: '56', title: 'Administrative and Support and Waste Management and Remediation Services', category: 'administrative', level: 2 },
  { code: '561', title: 'Administrative and Support Services', category: 'administrative', level: 3, parent: '56' },
  { code: '5611', title: 'Office Administrative Services', category: 'administrative', level: 4, parent: '561' },
  { code: '561110', title: 'Office Administrative Services', category: 'administrative', level: 6, parent: '5611' },
  
  // Waste Management - Medical
  { code: '562', title: 'Waste Management and Remediation Services', category: 'administrative', level: 3, parent: '56' },
  { code: '5621', title: 'Waste Collection', category: 'administrative', level: 4, parent: '562' },
  { code: '56211', title: 'Waste Collection', category: 'administrative', level: 5, parent: '5621' },
  { code: '562112', title: 'Hazardous Waste Collection', category: 'administrative', level: 6, parent: '56211' },
  { code: '5622', title: 'Waste Treatment and Disposal', category: 'administrative', level: 4, parent: '562' },
  { code: '56221', title: 'Waste Treatment and Disposal', category: 'administrative', level: 5, parent: '5622' },
  { code: '562211', title: 'Hazardous Waste Treatment and Disposal', category: 'administrative', level: 6, parent: '56221' },
  
  // Educational Services - Medical Training
  { code: '61', title: 'Educational Services', category: 'services', level: 2 },
  { code: '611', title: 'Educational Services', category: 'services', level: 3, parent: '61' },
  { code: '6113', title: 'Colleges, Universities, and Professional Schools', category: 'services', level: 4, parent: '611' },
  { code: '611519', title: 'Other Technical and Trade Schools', category: 'services', level: 6, parent: '6113' },
  
  // Healthcare and Social Assistance
  { code: '62', title: 'Health Care and Social Assistance', category: 'healthcare', level: 2 },
  
  // Ambulatory Health Care Services
  { code: '621', title: 'Ambulatory Health Care Services', category: 'healthcare', level: 3, parent: '62' },
  { code: '6211', title: 'Offices of Physicians', category: 'healthcare', level: 4, parent: '621' },
  { code: '62111', title: 'Offices of Physicians', category: 'healthcare', level: 5, parent: '6211' },
  { code: '621111', title: 'Offices of Physicians (except Mental Health Specialists)', category: 'healthcare', level: 6, parent: '62111' },
  { code: '621112', title: 'Offices of Physicians, Mental Health Specialists', category: 'healthcare', level: 6, parent: '62111' },
  
  // Dental Services
  { code: '6212', title: 'Offices of Dentists', category: 'healthcare', level: 4, parent: '621' },
  { code: '62121', title: 'Offices of Dentists', category: 'healthcare', level: 5, parent: '6212' },
  { code: '621210', title: 'Offices of Dentists', category: 'healthcare', level: 6, parent: '62121' },
  
  // Other Health Practitioners
  { code: '6213', title: 'Offices of Other Health Practitioners', category: 'healthcare', level: 4, parent: '621' },
  { code: '62131', title: 'Offices of Chiropractors', category: 'healthcare', level: 5, parent: '6213' },
  { code: '621310', title: 'Offices of Chiropractors', category: 'healthcare', level: 6, parent: '62131' },
  { code: '62132', title: 'Offices of Optometrists', category: 'healthcare', level: 5, parent: '6213' },
  { code: '621320', title: 'Offices of Optometrists', category: 'healthcare', level: 6, parent: '62132' },
  { code: '62133', title: 'Offices of Mental Health Practitioners (except Physicians)', category: 'healthcare', level: 5, parent: '6213' },
  { code: '621330', title: 'Offices of Mental Health Practitioners (except Physicians)', category: 'healthcare', level: 6, parent: '62133' },
  { code: '62134', title: 'Offices of Physical, Occupational and Speech Therapists, and Audiologists', category: 'healthcare', level: 5, parent: '6213' },
  { code: '621340', title: 'Offices of Physical, Occupational and Speech Therapists, and Audiologists', category: 'healthcare', level: 6, parent: '62134' },
  { code: '62139', title: 'Offices of All Other Health Practitioners', category: 'healthcare', level: 5, parent: '6213' },
  { code: '621391', title: 'Offices of Podiatrists', category: 'healthcare', level: 6, parent: '62139' },
  { code: '621399', title: 'Offices of All Other Miscellaneous Health Practitioners', category: 'healthcare', level: 6, parent: '62139' },
  
  // Outpatient Care Centers
  { code: '6214', title: 'Outpatient Care Centers', category: 'healthcare', level: 4, parent: '621' },
  { code: '62141', title: 'Family Planning Centers', category: 'healthcare', level: 5, parent: '6214' },
  { code: '621410', title: 'Family Planning Centers', category: 'healthcare', level: 6, parent: '62141' },
  { code: '62142', title: 'Outpatient Mental Health and Substance Abuse Centers', category: 'healthcare', level: 5, parent: '6214' },
  { code: '621420', title: 'Outpatient Mental Health and Substance Abuse Centers', category: 'healthcare', level: 6, parent: '62142' },
  { code: '62149', title: 'Other Outpatient Care Centers', category: 'healthcare', level: 5, parent: '6214' },
  { code: '621491', title: 'HMO Medical Centers', category: 'healthcare', level: 6, parent: '62149' },
  { code: '621492', title: 'Kidney Dialysis Centers', category: 'healthcare', level: 6, parent: '62149' },
  { code: '621493', title: 'Freestanding Ambulatory Surgical and Emergency Centers', category: 'healthcare', level: 6, parent: '62149' },
  { code: '621498', title: 'All Other Outpatient Care Centers', category: 'healthcare', level: 6, parent: '62149' },
  
  // Medical and Diagnostic Laboratories
  { code: '6215', title: 'Medical and Diagnostic Laboratories', category: 'healthcare', level: 4, parent: '621' },
  { code: '62151', title: 'Medical and Diagnostic Laboratories', category: 'healthcare', level: 5, parent: '6215' },
  { code: '621511', title: 'Medical Laboratories', category: 'healthcare', level: 6, parent: '62151' },
  { code: '621512', title: 'Diagnostic Imaging Centers', category: 'healthcare', level: 6, parent: '62151' },
  
  // Home Health Care Services
  { code: '6216', title: 'Home Health Care Services', category: 'healthcare', level: 4, parent: '621' },
  { code: '62161', title: 'Home Health Care Services', category: 'healthcare', level: 5, parent: '6216' },
  { code: '621610', title: 'Home Health Care Services', category: 'healthcare', level: 6, parent: '62161' },
  
  // Other Ambulatory Health Care Services
  { code: '6219', title: 'Other Ambulatory Health Care Services', category: 'healthcare', level: 4, parent: '621' },
  { code: '62191', title: 'Ambulance Services', category: 'healthcare', level: 5, parent: '6219' },
  { code: '621910', title: 'Ambulance Services', category: 'healthcare', level: 6, parent: '62191' },
  { code: '62199', title: 'All Other Ambulatory Health Care Services', category: 'healthcare', level: 5, parent: '6219' },
  { code: '621991', title: 'Blood and Organ Banks', category: 'healthcare', level: 6, parent: '62199' },
  { code: '621999', title: 'All Other Miscellaneous Ambulatory Health Care Services', category: 'healthcare', level: 6, parent: '62199' },
  
  // Hospitals
  { code: '622', title: 'Hospitals', category: 'healthcare', level: 3, parent: '62' },
  { code: '6221', title: 'General Medical and Surgical Hospitals', category: 'healthcare', level: 4, parent: '622' },
  { code: '62211', title: 'General Medical and Surgical Hospitals', category: 'healthcare', level: 5, parent: '6221' },
  { code: '622110', title: 'General Medical and Surgical Hospitals', category: 'healthcare', level: 6, parent: '62211' },
  { code: '6222', title: 'Psychiatric and Substance Abuse Hospitals', category: 'healthcare', level: 4, parent: '622' },
  { code: '62221', title: 'Psychiatric and Substance Abuse Hospitals', category: 'healthcare', level: 5, parent: '6222' },
  { code: '622210', title: 'Psychiatric and Substance Abuse Hospitals', category: 'healthcare', level: 6, parent: '62221' },
  { code: '6223', title: 'Specialty (except Psychiatric and Substance Abuse) Hospitals', category: 'healthcare', level: 4, parent: '622' },
  { code: '62231', title: 'Specialty (except Psychiatric and Substance Abuse) Hospitals', category: 'healthcare', level: 5, parent: '6223' },
  { code: '622310', title: 'Specialty (except Psychiatric and Substance Abuse) Hospitals', category: 'healthcare', level: 6, parent: '62231' },
  
  // Nursing and Residential Care Facilities
  { code: '623', title: 'Nursing and Residential Care Facilities', category: 'healthcare', level: 3, parent: '62' },
  { code: '6231', title: 'Nursing Care Facilities (Skilled Nursing Facilities)', category: 'healthcare', level: 4, parent: '623' },
  { code: '62311', title: 'Nursing Care Facilities (Skilled Nursing Facilities)', category: 'healthcare', level: 5, parent: '6231' },
  { code: '623110', title: 'Nursing Care Facilities (Skilled Nursing Facilities)', category: 'healthcare', level: 6, parent: '62311' },
  { code: '6232', title: 'Residential Intellectual and Developmental Disability, Mental Health, and Substance Abuse Facilities', category: 'healthcare', level: 4, parent: '623' },
  { code: '62321', title: 'Residential Intellectual and Developmental Disability Facilities', category: 'healthcare', level: 5, parent: '6232' },
  { code: '623210', title: 'Residential Intellectual and Developmental Disability Facilities', category: 'healthcare', level: 6, parent: '62321' },
  { code: '62322', title: 'Residential Mental Health and Substance Abuse Facilities', category: 'healthcare', level: 5, parent: '6232' },
  { code: '623220', title: 'Residential Mental Health and Substance Abuse Facilities', category: 'healthcare', level: 6, parent: '62322' },
  { code: '6233', title: 'Continuing Care Retirement Communities and Assisted Living Facilities for the Elderly', category: 'healthcare', level: 4, parent: '623' },
  { code: '62331', title: 'Continuing Care Retirement Communities and Assisted Living Facilities for the Elderly', category: 'healthcare', level: 5, parent: '6233' },
  { code: '623311', title: 'Continuing Care Retirement Communities', category: 'healthcare', level: 6, parent: '62331' },
  { code: '623312', title: 'Assisted Living Facilities for the Elderly', category: 'healthcare', level: 6, parent: '62331' },
  { code: '6239', title: 'Other Residential Care Facilities', category: 'healthcare', level: 4, parent: '623' },
  { code: '62399', title: 'Other Residential Care Facilities', category: 'healthcare', level: 5, parent: '6239' },
  { code: '623990', title: 'Other Residential Care Facilities', category: 'healthcare', level: 6, parent: '62399' },
  
  // Social Assistance
  { code: '624', title: 'Social Assistance', category: 'healthcare', level: 3, parent: '62' },
  { code: '6241', title: 'Individual and Family Services', category: 'healthcare', level: 4, parent: '624' },
  { code: '62411', title: 'Child and Youth Services', category: 'healthcare', level: 5, parent: '6241' },
  { code: '624110', title: 'Child and Youth Services', category: 'healthcare', level: 6, parent: '62411' },
  { code: '62412', title: 'Services for the Elderly and Persons with Disabilities', category: 'healthcare', level: 5, parent: '6241' },
  { code: '624120', title: 'Services for the Elderly and Persons with Disabilities', category: 'healthcare', level: 6, parent: '62412' },
  { code: '62419', title: 'Other Individual and Family Services', category: 'healthcare', level: 5, parent: '6241' },
  { code: '624190', title: 'Other Individual and Family Services', category: 'healthcare', level: 6, parent: '62419' },
  { code: '6242', title: 'Community Food and Housing, and Emergency and Other Relief Services', category: 'healthcare', level: 4, parent: '624' },
  { code: '62421', title: 'Community Food Services', category: 'healthcare', level: 5, parent: '6242' },
  { code: '624210', title: 'Community Food Services', category: 'healthcare', level: 6, parent: '62421' },
  { code: '62422', title: 'Community Housing Services', category: 'healthcare', level: 5, parent: '6242' },
  { code: '624221', title: 'Temporary Shelters', category: 'healthcare', level: 6, parent: '62422' },
  { code: '624229', title: 'Other Community Housing Services', category: 'healthcare', level: 6, parent: '62422' },
  { code: '62423', title: 'Emergency and Other Relief Services', category: 'healthcare', level: 5, parent: '6242' },
  { code: '624230', title: 'Emergency and Other Relief Services', category: 'healthcare', level: 6, parent: '62423' },
  { code: '6243', title: 'Vocational Rehabilitation Services', category: 'healthcare', level: 4, parent: '624' },
  { code: '62431', title: 'Vocational Rehabilitation Services', category: 'healthcare', level: 5, parent: '6243' },
  { code: '624310', title: 'Vocational Rehabilitation Services', category: 'healthcare', level: 6, parent: '62431' },
  { code: '6244', title: 'Child Care Services', category: 'healthcare', level: 4, parent: '624' },
  { code: '62441', title: 'Child Care Services', category: 'healthcare', level: 5, parent: '6244' },
  { code: '624410', title: 'Child Care Services', category: 'healthcare', level: 6, parent: '62441' },
  
  // Public Administration - Health
  { code: '92', title: 'Public Administration', category: 'public', level: 2 },
  { code: '923', title: 'Administration of Human Resource Programs', category: 'public', level: 3, parent: '92' },
  { code: '9231', title: 'Administration of Education, Public Health, and Other Human Resource Programs', category: 'public', level: 4, parent: '923' },
  { code: '92312', title: 'Administration of Public Health Programs', category: 'public', level: 5, parent: '9231' },
  { code: '923120', title: 'Administration of Public Health Programs', category: 'public', level: 6, parent: '92312' }
]

/**
 * Get all NAICS codes for a specific category
 */
export function getMedicalNAICSByCategory(category: MedicalNAICSCode['category']): MedicalNAICSCode[] {
  return MEDICAL_NAICS_CODES.filter(code => code.category === category)
}

/**
 * Get all 6-digit (most specific) NAICS codes
 */
export function getSpecificMedicalNAICS(): MedicalNAICSCode[] {
  return MEDICAL_NAICS_CODES.filter(code => code.level === 6)
}

/**
 * Get NAICS codes by level (2-6 digits)
 */
export function getMedicalNAICSByLevel(level: number): MedicalNAICSCode[] {
  return MEDICAL_NAICS_CODES.filter(code => code.level === level)
}

/**
 * Find NAICS code by code string
 */
export function findMedicalNAICS(code: string): MedicalNAICSCode | undefined {
  return MEDICAL_NAICS_CODES.find(naics => naics.code === code)
}

/**
 * Get related NAICS codes (same category)
 */
export function getRelatedMedicalNAICS(code: string): MedicalNAICSCode[] {
  const naics = findMedicalNAICS(code)
  if (!naics) return []
  
  return MEDICAL_NAICS_CODES.filter(n => 
    n.category === naics.category && n.code !== code
  )
}

/**
 * Check if a NAICS code is medical/healthcare related
 */
export function isMedicalNAICS(code: string): boolean {
  return MEDICAL_NAICS_CODES.some(naics => naics.code === code)
}

/**
 * Get hierarchical children of a NAICS code
 */
export function getMedicalNAICSChildren(parentCode: string): MedicalNAICSCode[] {
  return MEDICAL_NAICS_CODES.filter(code => code.parent === parentCode)
}

/**
 * Group NAICS codes by category for UI display
 */
export function getMedicalNAICSGrouped(): Record<string, MedicalNAICSCode[]> {
  const grouped: Record<string, MedicalNAICSCode[]> = {}
  
  MEDICAL_NAICS_CODES.forEach(code => {
    if (!grouped[code.category]) {
      grouped[code.category] = []
    }
    grouped[code.category].push(code)
  })
  
  return grouped
}

/**
 * Calculate enhanced match score for medical opportunities
 */
export function calculateMedicalMatchScore(
  opportunityNAICS: string,
  companyNAICS: string[]
): number {
  if (!opportunityNAICS || companyNAICS.length === 0) return 0
  
  // Check if opportunity NAICS is medical-related
  const isMedical = isMedicalNAICS(opportunityNAICS)
  if (!isMedical) return 0.1 // Low score for non-medical opportunities
  
  // Exact match
  if (companyNAICS.includes(opportunityNAICS)) return 1.0
  
  // Category match within medical industry
  const oppNAICS = findMedicalNAICS(opportunityNAICS)
  if (!oppNAICS) return 0.1
  
  const matchingCategory = companyNAICS.some(companyCode => {
    const companyNAICSInfo = findMedicalNAICS(companyCode)
    return companyNAICSInfo?.category === oppNAICS.category
  })
  
  if (matchingCategory) return 0.8
  
  // Partial NAICS prefix match (industry group)
  const hasPartialMatch = companyNAICS.some(companyCode => {
    const oppPrefix = opportunityNAICS.substring(0, 3)
    const companyPrefix = companyCode.substring(0, 3)
    return oppPrefix === companyPrefix
  })
  
  if (hasPartialMatch) return 0.6
  
  // Medical-related but different category
  return 0.3
}