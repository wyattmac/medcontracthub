/**
 * Opportunity Entity
 * Core business entity representing a federal contract opportunity
 */

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
}