/**
 * Company Profile Entity
 * Represents a company's profile and capabilities
 */

export interface ICompanyProfile {
  id: string
  name: string
  dunsNumber?: string
  cageCode?: string
  naicsCodes?: string[]
  certifications?: string[]
  employeesCount?: number
  annualRevenue?: number
  locations?: ICompanyLocation[]
  contractCapacity?: {
    min: number
    max: number
  }
  capabilities?: string[]
  pastPerformance?: IPastPerformance[]
  createdAt: Date
  updatedAt: Date
}

export interface ICompanyLocation {
  type: 'headquarters' | 'branch' | 'warehouse'
  address: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface IPastPerformance {
  contractNumber: string
  agency: string
  value: number
  startDate: Date
  endDate: Date
  description: string
  rating?: number
}

export class CompanyProfile implements ICompanyProfile {
  constructor(
    public id: string,
    public name: string,
    public createdAt: Date,
    public updatedAt: Date,
    public dunsNumber?: string,
    public cageCode?: string,
    public naicsCodes?: string[],
    public certifications?: string[],
    public employeesCount?: number,
    public annualRevenue?: number,
    public locations?: ICompanyLocation[],
    public contractCapacity?: { min: number; max: number },
    public capabilities?: string[],
    public pastPerformance?: IPastPerformance[]
  ) {}

  /**
   * Check if company has specific certification
   */
  hasCertification(cert: string): boolean {
    return this.certifications?.includes(cert) || false
  }

  /**
   * Get primary location
   */
  getPrimaryLocation(): ICompanyLocation | undefined {
    return this.locations?.find(loc => loc.type === 'headquarters') || 
           this.locations?.[0]
  }

  /**
   * Calculate company size category
   */
  getSizeCategory(): 'small' | 'medium' | 'large' {
    if (!this.employeesCount) return 'small'
    
    if (this.employeesCount < 50) return 'small'
    if (this.employeesCount < 500) return 'medium'
    return 'large'
  }

  /**
   * Check if company qualifies for small business set-asides
   */
  isSmallBusiness(): boolean {
    // Simplified check - in reality would check NAICS-specific size standards
    return this.getSizeCategory() === 'small' || 
           this.hasCertification('8(a)') ||
           this.hasCertification('HUBZone') ||
           this.hasCertification('WOSB')
  }

  /**
   * Get all states where company operates
   */
  getOperatingStates(): string[] {
    if (!this.locations) return []
    
    const states = new Set(this.locations.map(loc => loc.state))
    return Array.from(states)
  }

  /**
   * Calculate average past performance rating
   */
  getAverageRating(): number | null {
    if (!this.pastPerformance || this.pastPerformance.length === 0) {
      return null
    }

    const ratingsCount = this.pastPerformance.filter(p => p.rating).length
    if (ratingsCount === 0) return null

    const totalRating = this.pastPerformance.reduce(
      (sum, p) => sum + (p.rating || 0), 
      0
    )
    
    return totalRating / ratingsCount
  }

  /**
   * Convert to plain object
   */
  toJSON(): ICompanyProfile {
    return {
      id: this.id,
      name: this.name,
      dunsNumber: this.dunsNumber,
      cageCode: this.cageCode,
      naicsCodes: this.naicsCodes,
      certifications: this.certifications,
      employeesCount: this.employeesCount,
      annualRevenue: this.annualRevenue,
      locations: this.locations,
      contractCapacity: this.contractCapacity,
      capabilities: this.capabilities,
      pastPerformance: this.pastPerformance,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  /**
   * Create from database record
   */
  static fromDatabase(record: any): CompanyProfile {
    return new CompanyProfile(
      record.id,
      record.name,
      new Date(record.created_at),
      new Date(record.updated_at),
      record.duns_number,
      record.cage_code,
      record.naics_codes,
      record.certifications,
      record.employees_count,
      record.annual_revenue,
      record.locations,
      record.contract_capacity,
      record.capabilities,
      record.past_performance
    )
  }
}