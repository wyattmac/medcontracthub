import { z } from 'zod'
import { proposalBusinessSchema } from '../business-rules'
import { proposalWithComputedSchema } from '../computed-properties'
import { ValidationError } from '@/lib/errors/types'
import { apiLogger } from '@/lib/errors/logger'

/**
 * Proposal Validator Service
 * Provides comprehensive validation for proposal data with business rules
 */
export class ProposalValidator {
  static schema = proposalBusinessSchema
  static computedSchema = proposalWithComputedSchema

  /**
   * Validate proposal data with business rules
   */
  static async validateWithBusinessRules(data: unknown): Promise<z.infer<typeof proposalBusinessSchema>> {
    try {
      // First, perform schema validation
      const validated = this.schema.parse(data)
      
      // Additional business rule validations
      
      // 1. Validate proposal is not past due
      const dueDate = new Date(validated.dueDate)
      const now = new Date()
      
      if (dueDate < now && validated.status === 'draft') {
        throw new ValidationError('Cannot create draft proposal for past-due opportunity')
      }
      
      // 2. Validate word count limits
      const totalWordCount = validated.sections.reduce((sum, section) => sum + (section.wordCount || 0), 0)
      const MAX_WORD_COUNT = 50000 // Reasonable limit for proposals
      
      if (totalWordCount > MAX_WORD_COUNT) {
        apiLogger.warn('Proposal exceeds recommended word count', {
          proposalId: validated.opportunityId,
          totalWordCount,
          limit: MAX_WORD_COUNT
        })
      }
      
      // 3. Validate required sections have minimum content
      const MIN_SECTION_WORDS = 50
      validated.sections.forEach(section => {
        if (section.required && section.wordCount < MIN_SECTION_WORDS && validated.status !== 'draft') {
          throw new ValidationError(
            `Required section "${section.title}" must have at least ${MIN_SECTION_WORDS} words`
          )
        }
      })
      
      // 4. Validate status transitions
      if (validated.status === 'submitted' && !validated.submittedAt) {
        throw new ValidationError('Submitted proposals must have submission timestamp')
      }
      
      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Proposal validation failed', error.errors)
      }
      throw error
    }
  }

  /**
   * Validate and transform with computed properties
   */
  static async validateWithComputed(data: unknown): Promise<z.infer<typeof proposalWithComputedSchema>> {
    try {
      return this.computedSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Proposal validation failed', error.errors)
      }
      throw error
    }
  }

  /**
   * Validate proposal section update
   */
  static validateSectionUpdate(
    section: any,
    proposalStatus: string
  ): void {
    // Can only update sections in draft status
    if (proposalStatus !== 'draft') {
      throw new ValidationError('Can only update sections in draft proposals')
    }
    
    // Validate section structure
    if (!section.id || !section.title) {
      throw new ValidationError('Section must have ID and title')
    }
    
    // Validate content length
    const MAX_SECTION_LENGTH = 100000 // ~20,000 words
    if (section.content && section.content.length > MAX_SECTION_LENGTH) {
      throw new ValidationError('Section content exceeds maximum length')
    }
  }

  /**
   * Validate proposal submission readiness
   */
  static validateForSubmission(proposal: z.infer<typeof proposalBusinessSchema>): {
    canSubmit: boolean
    issues: string[]
  } {
    const issues: string[] = []
    
    // Check all required sections are complete
    const incompleteRequired = proposal.sections
      .filter(s => s.required && (!s.content || s.content.trim().length === 0))
      .map(s => s.title)
    
    if (incompleteRequired.length > 0) {
      issues.push(`Incomplete required sections: ${incompleteRequired.join(', ')}`)
    }
    
    // Check proposal is not past due
    const dueDate = new Date(proposal.dueDate)
    if (dueDate < new Date()) {
      issues.push('Proposal is past due date')
    }
    
    // Check minimum content in each section
    const MIN_WORDS_PER_SECTION = 100
    proposal.sections.forEach(section => {
      if (section.required && section.wordCount < MIN_WORDS_PER_SECTION) {
        issues.push(`Section "${section.title}" needs at least ${MIN_WORDS_PER_SECTION} words`)
      }
    })
    
    // Check proposal status
    if (proposal.status !== 'draft') {
      issues.push('Proposal has already been submitted')
    }
    
    return {
      canSubmit: issues.length === 0,
      issues
    }
  }

  /**
   * Validate status transition
   */
  static validateStatusTransition(
    currentStatus: string,
    newStatus: string
  ): void {
    const validTransitions: Record<string, string[]> = {
      'draft': ['submitted', 'cancelled'],
      'submitted': ['under_review', 'cancelled'],
      'under_review': ['awarded', 'rejected'],
      'awarded': [], // Terminal state
      'rejected': [], // Terminal state
      'cancelled': [] // Terminal state
    }
    
    const allowedTransitions = validTransitions[currentStatus] || []
    
    if (!allowedTransitions.includes(newStatus)) {
      throw new ValidationError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      )
    }
  }

  /**
   * Validate proposal attachments
   */
  static validateAttachments(attachments: any[]): void {
    const MAX_ATTACHMENTS = 10
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    if (attachments.length > MAX_ATTACHMENTS) {
      throw new ValidationError(`Maximum ${MAX_ATTACHMENTS} attachments allowed`)
    }
    
    attachments.forEach((attachment, index) => {
      if (!attachment.name || !attachment.type || !attachment.size) {
        throw new ValidationError(`Invalid attachment at position ${index + 1}`)
      }
      
      if (attachment.size > MAX_FILE_SIZE) {
        throw new ValidationError(
          `Attachment "${attachment.name}" exceeds maximum size of 10MB`
        )
      }
      
      if (!ALLOWED_TYPES.includes(attachment.type)) {
        throw new ValidationError(
          `Attachment "${attachment.name}" has unsupported file type`
        )
      }
    })
  }

  /**
   * Create safe proposal object for database insertion
   */
  static prepareDatabaseRecord(proposal: z.infer<typeof proposalBusinessSchema>): Record<string, any> {
    return {
      opportunity_id: proposal.opportunityId,
      title: proposal.title,
      status: proposal.status,
      sections: proposal.sections,
      submitted_at: proposal.submittedAt || null,
      due_date: proposal.dueDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  /**
   * Calculate proposal score/quality
   */
  static calculateProposalScore(proposal: z.infer<typeof proposalBusinessSchema>): {
    score: number
    breakdown: Record<string, number>
  } {
    const breakdown: Record<string, number> = {
      completeness: 0,
      contentQuality: 0,
      timeliness: 0,
      formatting: 0
    }
    
    // Completeness score (40%)
    const requiredSections = proposal.sections.filter(s => s.required)
    const completedRequired = requiredSections.filter(s => s.content && s.content.trim().length > 0)
    breakdown.completeness = (completedRequired.length / requiredSections.length) * 40
    
    // Content quality score (30%) - based on word count
    const avgWordsPerSection = proposal.sections.reduce((sum, s) => sum + s.wordCount, 0) / proposal.sections.length
    const qualityScore = Math.min(avgWordsPerSection / 500, 1) * 30 // 500 words = full score
    breakdown.contentQuality = qualityScore
    
    // Timeliness score (20%) - how early it was submitted
    if (proposal.submittedAt) {
      const dueDate = new Date(proposal.dueDate)
      const submitDate = new Date(proposal.submittedAt)
      const totalTime = dueDate.getTime() - new Date().getTime()
      const timeUsed = submitDate.getTime() - new Date().getTime()
      const timelinessRatio = 1 - (timeUsed / totalTime)
      breakdown.timeliness = Math.max(0, timelinessRatio * 20)
    }
    
    // Formatting score (10%) - based on section organization
    const hasAllSections = proposal.sections.length >= 5 // Assume 5 standard sections
    breakdown.formatting = hasAllSections ? 10 : 5
    
    const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0)
    
    return {
      score: Math.round(totalScore),
      breakdown
    }
  }
}