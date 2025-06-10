/**
 * Company Repository
 * 
 * Handles all database operations for companies with
 * caching, profile management, and subscription handling
 * 
 * Uses Context7-based patterns for Supabase integration
 * Reference: /supabase/supabase - profile management patterns
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { BaseRepository } from './base.repository'
import { CompanyValidator } from '@/lib/validation/services/company-validator'
import { NotFoundError, ValidationError } from '@/lib/errors/types'
import { startSpan } from '@/lib/monitoring/performance'

type CompanyRow = Database['public']['Tables']['companies']['Row']
type CompanyInsert = Database['public']['Tables']['companies']['Insert']
type CompanyUpdate = Database['public']['Tables']['companies']['Update']

export interface CompanyWithStats extends CompanyRow {
  total_opportunities_saved?: number
  total_proposals?: number
  total_users?: number
  subscription_end_date?: string
  is_subscription_active?: boolean
}

export interface CompanyOnboardingData {
  name: string
  duns_number?: string
  cage_code?: string
  ein?: string
  description?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  website?: string
  certifications?: string[]
  naics_codes?: string[]
  sam_registration_date?: string
  sam_expiration_date?: string
}

export class CompanyRepository extends BaseRepository<'companies', CompanyRow, CompanyInsert, CompanyUpdate> {
  // Cache for frequently accessed company data
  private cache = new Map<string, { data: CompanyRow; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'companies')
  }

  /**
   * Get company by ID with caching
   */
  async findById(id: string): Promise<CompanyRow | null> {
    // Check cache first
    const cached = this.getFromCache(id)
    if (cached) {
      this.logger.debug('Company cache hit', { id })
      return cached
    }

    const company = await super.findById(id)
    
    if (company) {
      this.setInCache(id, company)
    }

    return company
  }

  /**
   * Get company with full statistics
   */
  async findByIdWithDetails(id: string): Promise<CompanyWithStats | null> {
    const span = startSpan('CompanyRepository.findByIdWithStats')
    
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          profiles!profiles_company_id_fkey(count),
          saved_opportunities!saved_opportunities_company_id_fkey(count),
          proposals!proposals_company_id_fkey(count),
          subscriptions!subscriptions_company_id_fkey(
            status,
            current_period_end
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw this.handleError(error, 'findByIdWithStats', { id })
      }

      // Transform the response
      const company: CompanyWithStats = {
        ...data,
        total_users: (data as any).profiles?.[0]?.count || 0,
        total_opportunities_saved: (data as any).saved_opportunities?.[0]?.count || 0,
        total_proposals: (data as any).proposals?.[0]?.count || 0,
        subscription_end_date: (data as any).subscriptions?.[0]?.current_period_end,
        is_subscription_active: (data as any).subscriptions?.[0]?.status === 'active'
      }

      span?.setStatus('ok')
      return company
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Create company during onboarding
   */
  async createFromOnboarding(
    data: CompanyOnboardingData,
    userId: string
  ): Promise<CompanyRow> {
    const span = startSpan('CompanyRepository.createFromOnboarding')
    
    try {
      // Validate company data
      const validated = await CompanyValidator.validateCompanyWithBusinessRules(data)

      // Start a pseudo-transaction
      const company = await this.transaction(async (client) => {
        // Create company
        const { data: newCompany, error: companyError } = await client
          .from('companies')
          .insert({
            ...validated,
            subscription_plan: 'starter',
            subscription_status: 'trialing'
          })
          .select()
          .single()

        if (companyError) {
          throw this.handleError(companyError, 'createFromOnboarding.company', data)
        }

        // Update user profile with company_id
        const { error: profileError } = await client
          .from('profiles')
          .update({ 
            company_id: newCompany.id,
            role: 'owner'
          })
          .eq('id', userId)

        if (profileError) {
          throw this.handleError(profileError, 'createFromOnboarding.profile', {
            companyId: newCompany.id,
            userId
          })
        }

        this.logger.info('Company created during onboarding', {
          companyId: newCompany.id,
          userId
        })

        return newCompany
      })

      span?.setStatus('ok')
      return company
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Update company onboarding data
   */
  async updateOnboarding(
    id: string,
    data: Partial<CompanyOnboardingData>
  ): Promise<CompanyRow> {
    const span = startSpan('CompanyRepository.updateOnboarding')
    
    try {
      // Validate updates
      if (data.naics_codes || data.certifications) {
        await CompanyValidator.validateCompany(data)
      }

      const updated = await super.update(id, data as CompanyUpdate)

      // Invalidate cache
      this.invalidateCache(id)

      span?.setStatus('ok')
      return updated
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Update company profile
   */
  async updateProfile(
    id: string,
    updates: CompanyUpdate
  ): Promise<CompanyRow> {
    const span = startSpan('CompanyRepository.updateProfile')
    
    try {
      // Validate updates
      if (updates.naics_codes || updates.certifications) {
        await CompanyValidator.validateCompanyWithBusinessRules({
          ...updates,
          name: 'temp' // Required field for validation
        })
      }

      const updated = await super.update(id, updates)

      // Invalidate cache
      this.invalidateCache(id)

      span?.setStatus('ok')
      return updated
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Update subscription information
   */
  async updateSubscription(
    id: string,
    plan: 'starter' | 'professional' | 'enterprise',
    status: string,
    stripeCustomerId?: string
  ): Promise<CompanyRow> {
    const span = startSpan('CompanyRepository.updateSubscription')
    
    try {
      const updates: CompanyUpdate = {
        subscription_plan: plan,
        subscription_status: status,
        ...(stripeCustomerId && { stripe_customer_id: stripeCustomerId })
      }

      const updated = await super.update(id, updates)

      // Invalidate cache
      this.invalidateCache(id)

      this.logger.info('Company subscription updated', {
        companyId: id,
        plan,
        status
      })

      span?.setStatus('ok')
      return updated
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get companies with expiring SAM registrations
   */
  async getExpiringSAMRegistrations(daysAhead = 30): Promise<CompanyRow[]> {
    const span = startSpan('CompanyRepository.getExpiringSAMRegistrations')
    
    try {
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() + daysAhead)

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .not('sam_expiration_date', 'is', null)
        .lte('sam_expiration_date', expirationDate.toISOString())
        .gte('sam_expiration_date', new Date().toISOString())
        .order('sam_expiration_date', { ascending: true })

      if (error) {
        throw this.handleError(error, 'getExpiringSAMRegistrations', { daysAhead })
      }

      span?.setStatus('ok')
      return data || []
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get companies by subscription plan
   */
  async getBySubscriptionPlan(
    plan: 'starter' | 'professional' | 'enterprise'
  ): Promise<CompanyRow[]> {
    const span = startSpan('CompanyRepository.getBySubscriptionPlan')
    
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('subscription_plan', plan)
        .eq('subscription_status', 'active')

      if (error) {
        throw this.handleError(error, 'getBySubscriptionPlan', { plan })
      }

      span?.setStatus('ok')
      return data || []
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Search companies by name or identifiers
   */
  async search(query: string): Promise<CompanyRow[]> {
    const span = startSpan('CompanyRepository.search')
    
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .or(`name.ilike.%${query}%,duns_number.eq.${query},cage_code.eq.${query},ein.eq.${query}`)
        .limit(20)

      if (error) {
        throw this.handleError(error, 'search', { query })
      }

      span?.setStatus('ok')
      return data || []
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get company usage statistics
   */
  async getUsageStats(id: string, startDate?: Date, endDate?: Date): Promise<{
    opportunities_viewed: number
    opportunities_saved: number
    analyses_performed: number
    proposals_created: number
    documents_processed: number
  }> {
    const span = startSpan('CompanyRepository.getUsageStats')
    
    try {
      const filters: any = { company_id: id }
      
      if (startDate) {
        filters.created_at = { gte: startDate.toISOString() }
      }
      if (endDate) {
        filters.created_at = { ...filters.created_at, lte: endDate.toISOString() }
      }

      // Get counts from various tables
      const [saved, analyses, proposals, documents] = await Promise.all([
        this.supabase
          .from('saved_opportunities')
          .select('*', { count: 'exact', head: true })
          .match(filters),
        this.supabase
          .from('opportunity_analyses')
          .select('*', { count: 'exact', head: true })
          .match(filters),
        this.supabase
          .from('proposals')
          .select('*', { count: 'exact', head: true })
          .match(filters),
        this.supabase
          .from('contract_documents')
          .select('*', { count: 'exact', head: true })
          .match({ ...filters, processed: true })
      ])

      span?.setStatus('ok')
      
      return {
        opportunities_viewed: 0, // This would need tracking implementation
        opportunities_saved: saved.count || 0,
        analyses_performed: analyses.count || 0,
        proposals_created: proposals.count || 0,
        documents_processed: documents.count || 0
      }
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'getUsageStats', { id })
    } finally {
      span?.finish()
    }
  }

  /**
   * Cache management methods
   */
  private getFromCache(id: string): CompanyRow | null {
    const cached = this.cache.get(id)
    
    if (!cached) return null
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(id)
      return null
    }
    
    return cached.data
  }

  private setInCache(id: string, data: CompanyRow): void {
    this.cache.set(id, {
      data,
      timestamp: Date.now()
    })

    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
  }

  private invalidateCache(id: string): void {
    this.cache.delete(id)
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear()
    this.logger.debug('Company cache cleared')
  }

  /**
   * Add user to company
   */
  async addUser(companyId: string, userId: string, profileData: any): Promise<any> {
    const span = startSpan('CompanyRepository.addUser')
    
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .insert({
          id: userId,
          company_id: companyId,
          ...profileData
        })
        .select()
        .single()

      if (error) {
        throw this.handleError(error, 'addUser', { companyId, userId, profileData })
      }

      span?.setStatus('ok')
      return data
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Remove user from company
   */
  async removeUser(companyId: string, userId: string): Promise<void> {
    const span = startSpan('CompanyRepository.removeUser')
    
    try {
      // Check if user is the last owner
      const { data: owners, count } = await this.supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('role', 'owner')

      // Use count if available, otherwise check data length
      const ownerCount = count ?? owners?.length ?? 0
      
      if (ownerCount === 1 && owners?.[0]?.id === userId) {
        throw new ValidationError('Cannot remove the last owner from a company')
      }

      const { error } = await this.supabase
        .from('profiles')
        .update({ 
          company_id: null,
          role: null 
        })
        .eq('id', userId)
        .eq('company_id', companyId)

      if (error) {
        throw this.handleError(error, 'removeUser', { companyId, userId })
      }

      span?.setStatus('ok')
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Update user role in company
   */
  async updateUserRole(companyId: string, userId: string, newRole: 'owner' | 'admin' | 'member'): Promise<any> {
    const span = startSpan('CompanyRepository.updateUserRole')
    
    try {
      // Validate role transition
      const { data: user } = await this.supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .eq('company_id', companyId)
        .single()

      if (!user) {
        throw new NotFoundError('User not found in company')
      }

      // Check business rules for role transitions
      if (user.role === 'member' && newRole === 'owner') {
        throw new ValidationError('Cannot promote member directly to owner')
      }

      const { data, error } = await this.supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .eq('company_id', companyId)
        .select()
        .single()

      if (error) {
        throw this.handleError(error, 'updateUserRole', { companyId, userId, newRole })
      }

      span?.setStatus('ok')
      return data
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get company statistics
   */
  async getStatistics(companyId: string): Promise<{
    total_users: number
    total_opportunities: number
    total_proposals: number
    opportunities_won: number
    conversion_rate: number
  }> {
    const span = startSpan('CompanyRepository.getStatistics')
    
    try {
      const [users, opportunities, proposals, proposalsWon] = await Promise.all([
        this.supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId),
        this.supabase
          .from('saved_opportunities')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId),
        this.supabase
          .from('proposals')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId),
        this.supabase
          .from('proposals')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'won')
      ])

      const totalProposals = proposals.count || 0
      const wonProposals = proposalsWon.count || 0
      const conversionRate = totalProposals > 0 ? (wonProposals / totalProposals) * 100 : 0

      span?.setStatus('ok')
      return {
        total_users: users.count || 0,
        total_opportunities: opportunities.count || 0,
        total_proposals: totalProposals,
        opportunities_won: wonProposals,
        conversion_rate: Number(conversionRate.toFixed(2))
      }
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'getStatistics', { companyId })
    } finally {
      span?.finish()
    }
  }

  /**
   * Find company by Stripe customer ID
   */
  async findByStripeCustomerId(customerId: string): Promise<CompanyRow | null> {
    const span = startSpan('CompanyRepository.findByStripeCustomerId')
    
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('stripe_customer_id', customerId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw this.handleError(error, 'findByStripeCustomerId', { customerId })
      }

      span?.setStatus('ok')
      return data
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get active users for company
   */
  async getActiveUsers(companyId: string, daysActive: number = 30): Promise<Array<{
    id: string
    email: string
    name: string
    role: string
    last_active: string
  }>> {
    const span = startSpan('CompanyRepository.getActiveUsers')
    
    try {
      const activeDate = new Date()
      activeDate.setDate(activeDate.getDate() - daysActive)

      const { data, error } = await this.supabase
        .from('profiles')
        .select('id, email, name, role, last_active')
        .eq('company_id', companyId)
        .gte('last_active', activeDate.toISOString())
        .order('last_active', { ascending: false })

      if (error) {
        throw this.handleError(error, 'getActiveUsers', { companyId, daysActive })
      }

      span?.setStatus('ok')
      return data || []
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Update multiple companies
   */
  async updateMultiple(filter: Record<string, any>, updates: CompanyUpdate): Promise<CompanyRow[]> {
    return this.updateMany(filter, updates)
  }

  /**
   * Bulk update companies
   */
  async bulkUpdateCompanies(companies: Array<Partial<CompanyRow>>): Promise<CompanyRow[]> {
    const span = startSpan('CompanyRepository.bulkUpdateCompanies')
    
    try {
      if (!companies || companies.length === 0) {
        return []
      }

      const results: CompanyRow[] = []
      
      // Update each company individually
      for (const company of companies) {
        if (company.id) {
          const { id, ...updates } = company
          const updated = await this.update(id, updates as CompanyUpdate)
          results.push(updated)
        }
      }

      span?.setStatus('ok')
      return results
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }
}