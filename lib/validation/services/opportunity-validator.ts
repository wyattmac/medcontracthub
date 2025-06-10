import { z } from 'zod'
import { opportunityBusinessSchema, opportunityWithComputedSchema } from '../business-rules'
import { ValidationError } from '@/lib/errors/types'
import { apiLogger } from '@/lib/errors/logger'

/**
 * Opportunity Validator Service
 * Provides comprehensive validation for opportunity data with business rules
 */
export class OpportunityValidator {
  static schema = opportunityBusinessSchema
  static computedSchema = opportunityWithComputedSchema

  /**
   * Validate opportunity data with business rules
   */
  static async validateWithBusinessRules(data: unknown): Promise<z.infer<typeof opportunityBusinessSchema>> {
    try {
      // First, perform schema validation
      const validated = this.schema.parse(data)
      
      // Additional business rule validations
      
      // 1. Validate opportunity is not too old to pursue
      const postedDate = new Date(validated.postedDate)
      const daysSincePosted = Math.floor((Date.now() - postedDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSincePosted > 180) {
        apiLogger.warn('Opportunity is older than 180 days', { 
          noticeId: validated.noticeId, 
          daysSincePosted 
        })
      }
      
      // 2. Validate value range is reasonable
      if (validated.valueAmount) {
        if (validated.valueAmount.min > validated.valueAmount.max) {
          throw new ValidationError('Minimum value cannot exceed maximum value')
        }
        if (validated.valueAmount.max > 1_000_000_000) {
          apiLogger.warn('Unusually high contract value', { 
            noticeId: validated.noticeId, 
            maxValue: validated.valueAmount.max 
          })
        }
      }
      
      // 3. Validate NAICS codes are medical-related (warning only)
      const medicalNaicsPrefixes = ['3391', '4234', '4461', '6216', '6221', '6222', '6223']
      const hasMedicalNaics = validated.naicsCodes.some(code => 
        medicalNaicsPrefixes.some(prefix => code.startsWith(prefix))
      )
      if (!hasMedicalNaics) {
        apiLogger.info('Opportunity has no medical NAICS codes', { 
          noticeId: validated.noticeId,
          naicsCodes: validated.naicsCodes 
        })
      }
      
      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Opportunity validation failed', error.errors)
      }
      throw error
    }
  }

  /**
   * Validate and transform with computed properties
   */
  static async validateWithComputed(data: unknown): Promise<z.infer<typeof opportunityWithComputedSchema>> {
    try {
      return this.computedSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Opportunity validation failed', error.errors)
      }
      throw error
    }
  }

  /**
   * Validate opportunity for saving
   */
  static validateForSave(opportunityId: string, userId: string): void {
    if (!opportunityId || typeof opportunityId !== 'string') {
      throw new ValidationError('Invalid opportunity ID')
    }
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('Invalid user ID')
    }
  }

  /**
   * Validate search filters
   */
  static validateSearchFilters(filters: any): void {
    // Validate NAICS codes format
    if (filters.naicsCodes && Array.isArray(filters.naicsCodes)) {
      filters.naicsCodes.forEach((code: string) => {
        if (!/^\d{6}$/.test(code)) {
          throw new ValidationError(`Invalid NAICS code format: ${code}`)
        }
      })
    }
    
    // Validate date range
    if (filters.responseDeadlineFrom && filters.responseDeadlineTo) {
      const from = new Date(filters.responseDeadlineFrom)
      const to = new Date(filters.responseDeadlineTo)
      if (from > to) {
        throw new ValidationError('Invalid date range: start date must be before end date')
      }
    }
    
    // Validate state code
    if (filters.state && !/^[A-Z]{2}$/.test(filters.state)) {
      throw new ValidationError('Invalid state code format')
    }
  }

  /**
   * Validate bulk import data
   */
  static async validateBulkImport(opportunities: unknown[]): Promise<{
    valid: z.infer<typeof opportunityBusinessSchema>[]
    invalid: { index: number; errors: any }[]
  }> {
    const valid: z.infer<typeof opportunityBusinessSchema>[] = []
    const invalid: { index: number; errors: any }[] = []
    
    for (let i = 0; i < opportunities.length; i++) {
      try {
        const validated = await this.validateWithBusinessRules(opportunities[i])
        valid.push(validated)
      } catch (error) {
        invalid.push({
          index: i,
          errors: error instanceof z.ZodError ? error.errors : error
        })
      }
    }
    
    return { valid, invalid }
  }

  /**
   * Create safe opportunity object for database insertion
   */
  static prepareDatabaseRecord(opportunity: z.infer<typeof opportunityBusinessSchema>): Record<string, any> {
    return {
      notice_id: opportunity.noticeId,
      title: opportunity.title,
      agency: opportunity.agency,
      department: opportunity.department || null,
      posted_date: opportunity.postedDate,
      response_deadline: opportunity.responseDeadline,
      naics_codes: opportunity.naicsCodes,
      set_aside_types: opportunity.setAsideTypes,
      contract_type: opportunity.contractType,
      value_amount: opportunity.valueAmount || null,
      place_of_performance: opportunity.placeOfPerformance || null,
      description: opportunity.description,
      status: opportunity.status,
      active: opportunity.status === 'active'
    }
  }
}