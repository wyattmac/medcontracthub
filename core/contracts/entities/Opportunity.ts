/**
 * Opportunity Entity
 * Core business entity representing a federal contract opportunity
 */

import { opportunityWithComputedSchema, type OpportunityWithComputed } from '@/lib/validation/computed-properties'
import { z } from 'zod'

export interface IOpportunity {
  id: string
  noticeId: string
  title: string
  agency: string
  department?: string
  postedDate: Date
  responseDeadline: Date
  naicsCodes: string[]
  setAsideTypes: string[]
  contractType: ContractType
  valueAmount?: {
    min: number
    max: number
  }
  placeOfPerformance?: {
    state: string
    city?: string
  }
  description: string
  attachments?: IAttachment[]
  matchScore?: number
  active: boolean
  metadata?: Record<string, unknown>
}

export interface IAttachment {
  id: string
  name: string
  url: string
  size: number
  type: string
}

export enum ContractType {
  SUPPLY = 'supply',
  SERVICE = 'service',
  CONSTRUCTION = 'construction',
  RESEARCH = 'research'
}

export class Opportunity implements IOpportunity {
  constructor(
    public id: string,
    public noticeId: string,
    public title: string,
    public agency: string,
    public postedDate: Date,
    public responseDeadline: Date,
    public naicsCodes: string[],
    public setAsideTypes: string[],
    public contractType: ContractType,
    public description: string,
    public active: boolean,
    public department?: string,
    public valueAmount?: { min: number; max: number },
    public placeOfPerformance?: { state: string; city?: string },
    public attachments?: IAttachment[],
    public matchScore?: number,
    public metadata?: Record<string, unknown>
  ) {}

  /**
   * Check if opportunity is expiring soon (within 7 days)
   */
  isExpiringSoon(): boolean {
    const daysUntilDeadline = this.daysUntilDeadline()
    return daysUntilDeadline >= 0 && daysUntilDeadline <= 7
  }

  /**
   * Calculate days until response deadline
   */
  daysUntilDeadline(): number {
    const now = new Date()
    const diffTime = this.responseDeadline.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Check if opportunity matches company NAICS codes
   */
  matchesNaicsCodes(companyNaicsCodes: string[]): boolean {
    return this.naicsCodes.some(code => 
      companyNaicsCodes.includes(code)
    )
  }

  /**
   * Get formatted value range
   */
  getFormattedValue(): string {
    if (!this.valueAmount) return 'Not specified'
    
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    })
    
    return `${formatter.format(this.valueAmount.min)} - ${formatter.format(this.valueAmount.max)}`
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): IOpportunity {
    return {
      id: this.id,
      noticeId: this.noticeId,
      title: this.title,
      agency: this.agency,
      department: this.department,
      postedDate: this.postedDate,
      responseDeadline: this.responseDeadline,
      naicsCodes: this.naicsCodes,
      setAsideTypes: this.setAsideTypes,
      contractType: this.contractType,
      valueAmount: this.valueAmount,
      placeOfPerformance: this.placeOfPerformance,
      description: this.description,
      attachments: this.attachments,
      matchScore: this.matchScore,
      active: this.active,
      metadata: this.metadata
    }
  }

  /**
   * Create from database record
   */
  static fromDatabase(record: any): Opportunity {
    return new Opportunity(
      record.id,
      record.notice_id,
      record.title,
      record.agency,
      new Date(record.posted_date),
      new Date(record.response_deadline),
      record.naics_codes || [],
      record.set_aside_types || [],
      record.contract_type as ContractType,
      record.description,
      record.active,
      record.department,
      record.value_amount,
      record.place_of_performance,
      record.attachments,
      record.match_score,
      record.metadata
    )
  }

  /**
   * Create from database record with computed properties
   * Uses Zod schema for validation and adds computed properties
   */
  static fromDatabaseWithComputed(record: any): OpportunityWithComputed {
    // Transform database record to match schema expectations
    const transformedRecord = {
      id: record.id,
      noticeId: record.notice_id,
      title: record.title,
      agency: record.agency,
      department: record.department,
      postedDate: record.posted_date,
      responseDeadline: record.response_deadline,
      naicsCodes: record.naics_codes || [],
      setAsideTypes: record.set_aside_types || [],
      contractType: record.contract_type,
      valueAmount: record.value_amount,
      placeOfPerformance: record.place_of_performance,
      description: record.description,
      attachments: record.attachments || [],
      matchScore: record.match_score,
      active: record.active,
      metadata: record.metadata,
      status: record.status || 'active'
    }

    // Parse with computed properties schema
    return opportunityWithComputedSchema.parse(transformedRecord)
  }

  /**
   * Get urgency level based on deadline
   */
  getUrgencyLevel(): 'expired' | 'critical' | 'high' | 'medium' | 'low' {
    const days = this.daysUntilDeadline()
    if (days < 0) return 'expired'
    if (days <= 3) return 'critical'
    if (days <= 7) return 'high'
    if (days <= 14) return 'medium'
    return 'low'
  }

  /**
   * Check if opportunity has expired
   */
  isExpired(): boolean {
    return this.daysUntilDeadline() < 0
  }

  /**
   * Get formatted deadline with timezone
   */
  getFormattedDeadline(): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/New_York'
    })
    return formatter.format(this.responseDeadline)
  }

  /**
   * Check if opportunity matches company set-asides
   */
  matchesSetAsides(companyCertifications: string[]): boolean {
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
      return eligibleSetAsides.some(setAside => this.setAsideTypes.includes(setAside))
    })
  }
}