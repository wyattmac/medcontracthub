import { z } from 'zod'
import { companyBusinessSchema, companyWithComputedSchema } from '../business-rules'
import { ValidationError } from '@/lib/errors/types'
import { apiLogger } from '@/lib/errors/logger'
import { US_STATE_CODES, CERTIFICATION_TYPES } from '../constants'

/**
 * Company Validator Service
 * Provides comprehensive validation for company/profile data with business rules
 */
export class CompanyValidator {
  static schema = companyBusinessSchema
  static computedSchema = companyWithComputedSchema

  /**
   * Validate company data with business rules
   */
  static async validateWithBusinessRules(data: unknown): Promise<z.infer<typeof companyBusinessSchema>> {
    try {
      // First, perform schema validation
      const validated = this.schema.parse(data)
      
      // Additional business rule validations
      
      // 1. Validate SAM registration status
      if (validated.samRegistrationDate && validated.samExpirationDate) {
        const now = new Date()
        const expiration = new Date(validated.samExpirationDate)
        
        if (expiration < now) {
          apiLogger.warn('SAM registration has expired', {
            companyName: validated.name,
            expiredDate: validated.samExpirationDate
          })
        } else {
          const daysUntilExpiration = Math.floor((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          if (daysUntilExpiration <= 30) {
            apiLogger.warn('SAM registration expiring soon', {
              companyName: validated.name,
              daysRemaining: daysUntilExpiration
            })
          }
        }
      }
      
      // 2. Validate certifications are recognized
      const unrecognizedCerts = validated.certifications.filter(
        cert => !CERTIFICATION_TYPES.includes(cert as any)
      )
      if (unrecognizedCerts.length > 0) {
        apiLogger.info('Company has unrecognized certifications', {
          companyName: validated.name,
          unrecognizedCerts
        })
      }
      
      // 3. Validate NAICS codes for medical industry focus
      const medicalNaicsPrefixes = ['3391', '4234', '4461', '6216', '6221', '6222', '6223']
      const medicalNaicsCount = validated.naicsCodes.filter(code => 
        medicalNaicsPrefixes.some(prefix => code.startsWith(prefix))
      ).length
      
      const medicalFocusPercentage = (medicalNaicsCount / validated.naicsCodes.length) * 100
      if (medicalFocusPercentage < 50) {
        apiLogger.info('Company has limited medical industry focus', {
          companyName: validated.name,
          medicalFocusPercentage: medicalFocusPercentage.toFixed(2)
        })
      }
      
      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Company validation failed', error.errors)
      }
      throw error
    }
  }

  /**
   * Validate and transform with computed properties
   */
  static async validateWithComputed(data: unknown): Promise<z.infer<typeof companyWithComputedSchema>> {
    try {
      return this.computedSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Company validation failed', error.errors)
      }
      throw error
    }
  }

  /**
   * Validate company profile for onboarding
   */
  static validateForOnboarding(data: any): void {
    const requiredFields = ['name', 'naicsCodes']
    const missingFields = requiredFields.filter(field => !data[field])
    
    if (missingFields.length > 0) {
      throw new ValidationError(`Missing required fields for onboarding: ${missingFields.join(', ')}`)
    }
    
    // At least one NAICS code required
    if (!Array.isArray(data.naicsCodes) || data.naicsCodes.length === 0) {
      throw new ValidationError('At least one NAICS code is required')
    }
    
    // Either DUNS or CAGE required for government contracting
    if (!data.dunsNumber && !data.cageCode) {
      throw new ValidationError('Either DUNS number or CAGE code is required for government contracting')
    }
  }

  /**
   * Validate address data
   */
  static validateAddress(address: any): void {
    if (!address) {
      throw new ValidationError('Address is required')
    }
    
    const requiredFields = ['line1', 'city', 'state', 'zipCode']
    const missingFields = requiredFields.filter(field => !address[field])
    
    if (missingFields.length > 0) {
      throw new ValidationError(`Missing address fields: ${missingFields.join(', ')}`)
    }
    
    // Validate state code
    if (!US_STATE_CODES.includes(address.state)) {
      throw new ValidationError(`Invalid state code: ${address.state}`)
    }
    
    // Validate ZIP code format
    if (!/^\d{5}(?:-\d{4})?$/.test(address.zipCode)) {
      throw new ValidationError('Invalid ZIP code format')
    }
  }

  /**
   * Validate subscription change
   */
  static validateSubscriptionChange(
    currentPlan: string, 
    newPlan: string,
    hasPaymentMethod: boolean
  ): void {
    const validPlans = ['starter', 'pro', 'enterprise']
    
    if (!validPlans.includes(newPlan)) {
      throw new ValidationError(`Invalid subscription plan: ${newPlan}`)
    }
    
    // Can't downgrade from enterprise to starter directly
    if (currentPlan === 'enterprise' && newPlan === 'starter') {
      throw new ValidationError('Cannot downgrade directly from Enterprise to Starter. Please contact support.')
    }
    
    // Pro and Enterprise require payment method
    if (newPlan !== 'starter' && !hasPaymentMethod) {
      throw new ValidationError('Payment method required for Pro and Enterprise plans')
    }
  }

  /**
   * Create safe company object for database insertion
   */
  static prepareDatabaseRecord(company: z.infer<typeof companyBusinessSchema>): Record<string, any> {
    return {
      name: company.name,
      duns_number: company.dunsNumber || null,
      cage_code: company.cageCode || null,
      naics_codes: company.naicsCodes,
      certifications: company.certifications,
      sam_registration_date: company.samRegistrationDate || null,
      sam_expiration_date: company.samExpirationDate || null,
      updated_at: new Date().toISOString()
    }
  }

  /**
   * Validate company eligibility for opportunities
   */
  static validateOpportunityEligibility(
    company: z.infer<typeof companyBusinessSchema>,
    opportunitySetAsides: string[]
  ): { eligible: boolean; reasons: string[] } {
    const reasons: string[] = []
    let eligible = true
    
    // Check if company has required certifications for set-asides
    if (opportunitySetAsides.length > 0) {
      const companySetAsides = this.getEligibleSetAsides(company.certifications)
      const hasMatchingSetAside = opportunitySetAsides.some(
        setAside => companySetAsides.includes(setAside)
      )
      
      if (!hasMatchingSetAside && !opportunitySetAsides.includes('Total Small Business')) {
        eligible = false
        reasons.push('Company lacks required certifications for opportunity set-asides')
      }
    }
    
    // Check SAM registration status
    if (company.samExpirationDate) {
      const expiration = new Date(company.samExpirationDate)
      if (expiration < new Date()) {
        eligible = false
        reasons.push('SAM registration has expired')
      }
    } else {
      reasons.push('No SAM registration on file')
    }
    
    return { eligible, reasons }
  }

  /**
   * Get eligible set-asides based on certifications
   */
  private static getEligibleSetAsides(certifications: string[]): string[] {
    const setAsides: string[] = ['Total Small Business'] // Default for all small businesses
    
    const certToSetAside: Record<string, string[]> = {
      'WOSB': ['Women-Owned Small Business (WOSB)'],
      'EDWOSB': ['Economically Disadvantaged WOSB (EDWOSB)', 'Women-Owned Small Business (WOSB)'],
      'HUBZone': ['HUBZone Small Business'],
      'SDVOSB': ['Service-Disabled Veteran-Owned Small Business (SDVOSB)', 'Veteran-Owned Small Business (VOSB)'],
      'VOSB': ['Veteran-Owned Small Business (VOSB)'],
      '8(a)': ['8(a) Business Development'],
      'Native American': ['Native American Owned']
    }
    
    certifications.forEach(cert => {
      const additionalSetAsides = certToSetAside[cert]
      if (additionalSetAsides) {
        setAsides.push(...additionalSetAsides)
      }
    })
    
    return [...new Set(setAsides)] // Remove duplicates
  }
}