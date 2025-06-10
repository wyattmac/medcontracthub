/**
 * Opportunity Repository
 * 
 * Handles all database operations for opportunities with
 * optimized queries, caching, and business logic
 * 
 * Uses Context7-based patterns for Supabase integration
 * Reference: /supabase/supabase - complex query patterns
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { BaseRepository, QueryOptions, PaginatedResult } from './base.repository'
import { OpportunityValidator } from '@/lib/validation/services/opportunity-validator'
import { MEDICAL_NAICS_CODES } from '@/lib/constants/medical-naics'
import { NotFoundError, ValidationError } from '@/lib/errors/types'
import { startSpan } from '@/lib/monitoring/performance'

type OpportunityRow = Database['public']['Tables']['opportunities']['Row']
type OpportunityInsert = Database['public']['Tables']['opportunities']['Insert']
type OpportunityUpdate = Database['public']['Tables']['opportunities']['Update']

export interface OpportunitySearchParams {
  query?: string
  naicsCodes?: string[]
  setAsides?: string[]
  minValue?: number
  maxValue?: number
  postedAfter?: Date
  deadlineBefore?: Date
  deadlineAfter?: Date
  agencies?: string[]
  statuses?: string[]
  includeExpired?: boolean
  onlyMedical?: boolean
}

export interface OpportunitySaveParams {
  userId: string
  opportunityId: string
  notes?: string
  reminderDate?: Date
}

export interface OpportunityWithMetadata extends OpportunityRow {
  is_saved?: boolean
  save_count?: number
  analysis_count?: number
  proposal_count?: number
  days_until_deadline?: number
  is_expiring_soon?: boolean
}

export class OpportunityRepository extends BaseRepository<'opportunities', OpportunityRow, OpportunityInsert, OpportunityUpdate> {
  // Optimized column selections for different use cases
  private readonly listSelect = `
    id, 
    notice_id, 
    title, 
    agency, 
    posted_date, 
    response_deadline,
    naics_codes,
    set_aside_codes,
    contract_type,
    estimated_value_min,
    estimated_value_max,
    active
  `

  private readonly detailSelect = `
    *,
    saved_opportunities!inner(
      user_id,
      notes,
      reminder_date
    ),
    opportunity_analyses(
      id,
      score,
      strengths,
      weaknesses,
      created_at
    ),
    contract_documents(
      id,
      document_name,
      document_type,
      file_size,
      processed
    )
  `

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'opportunities')
    this.defaultSelect = this.listSelect
  }

  /**
   * Search opportunities with advanced filtering
   */
  async search(
    params: OpportunitySearchParams,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResult<OpportunityWithMetadata>> {
    const span = startSpan('OpportunityRepository.search')
    
    try {
      const offset = (page - 1) * pageSize
      
      // Build base query
      let query = this.supabase
        .from(this.tableName)
        .select(this.listSelect, { count: 'exact' })

      // Apply filters
      query = this.applySearchFilters(query, params)

      // Apply pagination and ordering
      query = query
        .order('response_deadline', { ascending: true })
        .order('posted_date', { ascending: false })
        .range(offset, offset + pageSize - 1)

      const { data, error, count } = await query

      if (error) {
        throw this.handleError(error, 'search', { params })
      }

      // Enhance with metadata
      const enhanced = await this.enhanceWithMetadata(data || [])

      const total = count || 0
      const totalPages = Math.ceil(total / pageSize)

      span?.setStatus('ok')
      
      return {
        data: enhanced,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1
        }
      }
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get opportunity with full details
   */
  async findByIdWithDetails(id: string, userId?: string): Promise<OpportunityWithMetadata | null> {
    const span = startSpan('OpportunityRepository.findByIdWithDetails')
    
    try {
      // Get opportunity with related data
      let query = this.supabase
        .from(this.tableName)
        .select(this.detailSelect)
        .eq('id', id)

      if (userId) {
        query = query.eq('saved_opportunities.user_id', userId)
      }

      const { data, error } = await query.single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw this.handleError(error, 'findByIdWithDetails', { id })
      }

      // Transform and enhance data
      const enhanced = await this.enhanceWithMetadata([data])
      
      span?.setStatus('ok')
      return enhanced[0]
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get opportunities by notice IDs (batch operation)
   */
  async findByNoticeIds(noticeIds: string[]): Promise<OpportunityRow[]> {
    if (noticeIds.length === 0) return []

    const span = startSpan('OpportunityRepository.findByNoticeIds')
    
    try {
      // Batch fetch in chunks of 100 to avoid query size limits
      const chunks = this.chunkArray(noticeIds, 100)
      const results: OpportunityRow[] = []

      for (const chunk of chunks) {
        const { data, error } = await this.supabase
          .from(this.tableName)
          .select(this.listSelect)
          .in('notice_id', chunk)

        if (error) {
          throw this.handleError(error, 'findByNoticeIds', { count: chunk.length })
        }

        results.push(...(data || []))
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

  /**
   * Save opportunity for user
   */
  async saveForUser(params: OpportunitySaveParams): Promise<void> {
    const { userId, opportunityId, notes, reminderDate } = params

    try {
      // Validate opportunity exists
      const exists = await this.exists({ id: opportunityId })
      if (!exists) {
        throw new NotFoundError('Opportunity not found')
      }

      // Upsert saved opportunity
      const { error } = await this.supabase
        .from('saved_opportunities')
        .upsert({
          user_id: userId,
          opportunity_id: opportunityId,
          notes,
          reminder_date: reminderDate?.toISOString(),
          saved_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,opportunity_id'
        })

      if (error) {
        throw this.handleError(error, 'saveForUser', params)
      }

      this.logger.info('Opportunity saved for user', { userId, opportunityId })
    } catch (error) {
      throw this.handleError(error, 'saveForUser', params)
    }
  }

  /**
   * Unsave opportunity for user
   */
  async unsaveForUser(userId: string, opportunityId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('saved_opportunities')
        .delete()
        .eq('user_id', userId)
        .eq('opportunity_id', opportunityId)

      if (error) {
        throw this.handleError(error, 'unsaveForUser', { userId, opportunityId })
      }

      this.logger.info('Opportunity unsaved for user', { userId, opportunityId })
    } catch (error) {
      throw this.handleError(error, 'unsaveForUser', { userId, opportunityId })
    }
  }

  /**
   * Get saved opportunities for user
   */
  async getSavedForUser(
    userId: string,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResult<OpportunityWithMetadata>> {
    const span = startSpan('OpportunityRepository.getSavedForUser')
    
    try {
      const offset = (page - 1) * pageSize

      const { data, error, count } = await this.supabase
        .from('saved_opportunities')
        .select(`
          opportunity_id,
          notes,
          reminder_date,
          saved_at,
          opportunities!inner(${this.listSelect})
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('saved_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (error) {
        throw this.handleError(error, 'getSavedForUser', { userId })
      }

      // Transform to opportunity format
      const opportunities = (data || []).map(item => ({
        ...(item as any).opportunities,
        is_saved: true,
        saved_notes: item.notes,
        saved_reminder_date: item.reminder_date
      }))

      const enhanced = await this.enhanceWithMetadata(opportunities)

      const total = count || 0
      const totalPages = Math.ceil(total / pageSize)

      span?.setStatus('ok')
      
      return {
        data: enhanced,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1
        }
      }
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get expiring opportunities
   */
  async getExpiring(daysAhead = 7): Promise<OpportunityWithMetadata[]> {
    const span = startSpan('OpportunityRepository.getExpiring')
    
    try {
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + daysAhead)

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(this.listSelect)
        .eq('active', true)
        .gte('response_deadline', new Date().toISOString())
        .lte('response_deadline', deadline.toISOString())
        .order('response_deadline', { ascending: true })

      if (error) {
        throw this.handleError(error, 'getExpiring', { daysAhead })
      }

      const enhanced = await this.enhanceWithMetadata(data || [])
      
      span?.setStatus('ok')
      return enhanced
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Bulk upsert opportunities (for sync operations)
   */
  async bulkUpsert(opportunities: OpportunityInsert[]): Promise<number> {
    if (opportunities.length === 0) return 0

    const span = startSpan('OpportunityRepository.bulkUpsert')
    
    try {
      // Validate all opportunities
      const validated = await Promise.all(
        opportunities.map(opp => 
          OpportunityValidator.validateOpportunityWithBusinessRules(opp)
        )
      )

      // Upsert in batches of 100
      const chunks = this.chunkArray(validated, 100)
      let totalUpserted = 0

      for (const chunk of chunks) {
        const { data, error } = await this.supabase
          .from(this.tableName)
          .upsert(chunk, {
            onConflict: 'notice_id',
            ignoreDuplicates: false
          })
          .select('id')

        if (error) {
          this.logger.error('Bulk upsert chunk failed', error, { 
            chunkSize: chunk.length 
          })
          // Continue with other chunks
          continue
        }

        totalUpserted += data?.length || 0
      }

      this.logger.info('Bulk upserted opportunities', { 
        total: totalUpserted,
        requested: opportunities.length 
      })

      span?.setStatus('ok')
      return totalUpserted
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'bulkUpsert', { 
        count: opportunities.length 
      })
    } finally {
      span?.finish()
    }
  }

  /**
   * Get statistics for opportunities
   */
  async getStatistics(userId?: string): Promise<{
    total: number
    active: number
    expiringSoon: number
    saved: number
    byAgency: Record<string, number>
    byNaics: Record<string, number>
  }> {
    const span = startSpan('OpportunityRepository.getStatistics')
    
    try {
      // Total and active count
      const { count: total } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })

      const { count: active } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .gte('response_deadline', new Date().toISOString())

      // Expiring soon (next 7 days)
      const weekFromNow = new Date()
      weekFromNow.setDate(weekFromNow.getDate() + 7)
      
      const { count: expiringSoon } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .gte('response_deadline', new Date().toISOString())
        .lte('response_deadline', weekFromNow.toISOString())

      // Saved count for user
      let saved = 0
      if (userId) {
        const { count } = await this.supabase
          .from('saved_opportunities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
        saved = count || 0
      }

      // Group by agency (top 10)
      const { data: agencyData } = await this.supabase
        .from(this.tableName)
        .select('agency')
        .eq('active', true)

      const byAgency: Record<string, number> = {}
      agencyData?.forEach(item => {
        byAgency[item.agency] = (byAgency[item.agency] || 0) + 1
      })

      // Group by NAICS (medical only)
      const { data: naicsData } = await this.supabase
        .from(this.tableName)
        .select('naics_codes')
        .eq('active', true)

      const byNaics: Record<string, number> = {}
      naicsData?.forEach(item => {
        item.naics_codes?.forEach(code => {
          if (MEDICAL_NAICS_CODES.some(mc => code.startsWith(mc.code))) {
            byNaics[code] = (byNaics[code] || 0) + 1
          }
        })
      })

      span?.setStatus('ok')
      
      return {
        total: total || 0,
        active: active || 0,
        expiringSoon: expiringSoon || 0,
        saved,
        byAgency,
        byNaics
      }
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'getStatistics')
    } finally {
      span?.finish()
    }
  }

  /**
   * Apply search filters to query
   */
  private applySearchFilters(query: any, params: OpportunitySearchParams): any {
    // Text search
    if (params.query) {
      query = query.or(`title.ilike.%${params.query}%,description.ilike.%${params.query}%`)
    }

    // NAICS codes filter
    if (params.naicsCodes && params.naicsCodes.length > 0) {
      query = query.contains('naics_codes', params.naicsCodes)
    }

    // Medical only filter
    if (params.onlyMedical) {
      const medicalCodes = MEDICAL_NAICS_CODES.map(mc => mc.code)
      query = query.or(
        medicalCodes.map(code => `naics_codes.cs.{${code}}`).join(',')
      )
    }

    // Set-aside codes filter
    if (params.setAsides && params.setAsides.length > 0) {
      query = query.contains('set_aside_codes', params.setAsides)
    }

    // Value range filter
    if (params.minValue !== undefined) {
      query = query.gte('estimated_value_max', params.minValue)
    }
    if (params.maxValue !== undefined) {
      query = query.lte('estimated_value_min', params.maxValue)
    }

    // Date filters
    if (params.postedAfter) {
      query = query.gte('posted_date', params.postedAfter.toISOString())
    }
    if (params.deadlineBefore) {
      query = query.lte('response_deadline', params.deadlineBefore.toISOString())
    }
    if (params.deadlineAfter) {
      query = query.gte('response_deadline', params.deadlineAfter.toISOString())
    }

    // Agency filter
    if (params.agencies && params.agencies.length > 0) {
      query = query.in('agency', params.agencies)
    }

    // Status filter
    if (!params.includeExpired) {
      query = query.eq('active', true)
        .gte('response_deadline', new Date().toISOString())
    }

    return query
  }

  /**
   * Enhance opportunities with computed metadata
   */
  private async enhanceWithMetadata(
    opportunities: any[]
  ): Promise<OpportunityWithMetadata[]> {
    const now = new Date()

    return opportunities.map(opp => {
      const deadline = new Date(opp.response_deadline)
      const daysUntilDeadline = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      return {
        ...opp,
        days_until_deadline: daysUntilDeadline,
        is_expiring_soon: daysUntilDeadline <= 7 && daysUntilDeadline > 0
      }
    })
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}