/**
 * Opportunity Repository
 * Data access layer for opportunities
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Opportunity } from '../entities/Opportunity'
import { IOpportunityFilters, IOpportunitySearchResult } from '../services/OpportunityService'
import { DatabaseError } from '@/shared/types/errors'
import { Database } from '@/shared/types/database'

export class OpportunityRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Search opportunities with filters
   */
  async search(filters: IOpportunityFilters): Promise<IOpportunitySearchResult> {
    try {
      let query = this.supabase
        .from('opportunities')
        .select('*, saved_opportunities!left(user_id)', { count: 'exact' })
        .eq('active', filters.active ?? true)
        .order('response_deadline', { ascending: true })

      // Apply filters
      if (filters.searchQuery) {
        query = query.or(
          `title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`
        )
      }

      if (filters.naicsCodes && filters.naicsCodes.length > 0) {
        query = query.contains('naics_codes', filters.naicsCodes)
      }

      if (filters.state) {
        query = query.eq('place_of_performance->state', filters.state)
      }

      if (filters.minValue) {
        query = query.gte('value_amount->min', filters.minValue)
      }

      if (filters.maxValue) {
        query = query.lte('value_amount->max', filters.maxValue)
      }

      if (filters.deadlineFrom) {
        query = query.gte('response_deadline', filters.deadlineFrom.toISOString())
      }

      if (filters.deadlineTo) {
        query = query.lte('response_deadline', filters.deadlineTo.toISOString())
      }

      // Pagination
      const limit = filters.limit || 25
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        throw new DatabaseError('Failed to search opportunities', error)
      }

      const opportunities = (data || []).map(record => 
        Opportunity.fromDatabase(record)
      )

      return {
        opportunities,
        totalCount: count || 0,
        hasMore: (offset + limit) < (count || 0),
        nextOffset: opportunities.length === limit ? offset + limit : undefined
      }
    } catch (error) {
      throw new DatabaseError('Failed to search opportunities', error)
    }
  }

  /**
   * Find opportunity by ID
   */
  async findById(id: string): Promise<Opportunity | null> {
    try {
      const { data, error } = await this.supabase
        .from('opportunities')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // Not found
        }
        throw new DatabaseError('Failed to find opportunity', error)
      }

      return data ? Opportunity.fromDatabase(data) : null
    } catch (error) {
      throw new DatabaseError('Failed to find opportunity', error)
    }
  }

  /**
   * Find opportunities by IDs
   */
  async findByIds(ids: string[]): Promise<Opportunity[]> {
    if (ids.length === 0) return []

    try {
      const { data, error } = await this.supabase
        .from('opportunities')
        .select('*')
        .in('id', ids)

      if (error) {
        throw new DatabaseError('Failed to find opportunities', error)
      }

      return (data || []).map(record => Opportunity.fromDatabase(record))
    } catch (error) {
      throw new DatabaseError('Failed to find opportunities', error)
    }
  }

  /**
   * Save opportunity for user
   */
  async saveForUser(
    opportunityId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('saved_opportunities')
        .upsert({
          opportunity_id: opportunityId,
          user_id: userId,
          notes,
          saved_at: new Date().toISOString()
        }, {
          onConflict: 'opportunity_id,user_id'
        })

      if (error) {
        throw new DatabaseError('Failed to save opportunity', error)
      }
    } catch (error) {
      throw new DatabaseError('Failed to save opportunity', error)
    }
  }

  /**
   * Remove saved opportunity
   */
  async removeSavedForUser(
    opportunityId: string,
    userId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('saved_opportunities')
        .delete()
        .eq('opportunity_id', opportunityId)
        .eq('user_id', userId)

      if (error) {
        throw new DatabaseError('Failed to remove saved opportunity', error)
      }
    } catch (error) {
      throw new DatabaseError('Failed to remove saved opportunity', error)
    }
  }

  /**
   * Find saved opportunities by user
   */
  async findSavedByUser(userId: string): Promise<Opportunity[]> {
    try {
      const { data, error } = await this.supabase
        .from('saved_opportunities')
        .select(`
          opportunity_id,
          notes,
          saved_at,
          opportunities!inner(*)
        `)
        .eq('user_id', userId)
        .order('saved_at', { ascending: false })

      if (error) {
        throw new DatabaseError('Failed to find saved opportunities', error)
      }

      return (data || []).map(record => {
        const opp = Opportunity.fromDatabase(record.opportunities)
        // Add saved metadata
        opp.metadata = {
          ...opp.metadata,
          savedNotes: record.notes,
          savedAt: record.saved_at
        }
        return opp
      })
    } catch (error) {
      throw new DatabaseError('Failed to find saved opportunities', error)
    }
  }

  /**
   * Bulk insert opportunities (for sync)
   */
  async bulkUpsert(opportunities: Opportunity[]): Promise<void> {
    if (opportunities.length === 0) return

    try {
      const records = opportunities.map(opp => ({
        id: opp.id,
        notice_id: opp.noticeId,
        title: opp.title,
        agency: opp.agency,
        department: opp.department,
        posted_date: opp.postedDate.toISOString(),
        response_deadline: opp.responseDeadline.toISOString(),
        naics_codes: opp.naicsCodes,
        set_aside_types: opp.setAsideTypes,
        contract_type: opp.contractType,
        value_amount: opp.valueAmount,
        place_of_performance: opp.placeOfPerformance,
        description: opp.description,
        attachments: opp.attachments,
        active: opp.active,
        metadata: opp.metadata,
        updated_at: new Date().toISOString()
      }))

      const { error } = await this.supabase
        .from('opportunities')
        .upsert(records, {
          onConflict: 'notice_id'
        })

      if (error) {
        throw new DatabaseError('Failed to bulk upsert opportunities', error)
      }
    } catch (error) {
      throw new DatabaseError('Failed to bulk upsert opportunities', error)
    }
  }

  /**
   * Get opportunity statistics
   */
  async getStats(naicsCodes?: string[]) {
    try {
      // Total active opportunities
      const { count: totalActive } = await this.supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)

      // Opportunities by NAICS
      let naicsCount = 0
      if (naicsCodes && naicsCodes.length > 0) {
        const { count } = await this.supabase
          .from('opportunities')
          .select('*', { count: 'exact', head: true })
          .eq('active', true)
          .contains('naics_codes', naicsCodes)
        naicsCount = count || 0
      }

      // Expiring soon (next 7 days)
      const sevenDaysFromNow = new Date()
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
      
      const { count: expiringSoon } = await this.supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .gte('response_deadline', new Date().toISOString())
        .lte('response_deadline', sevenDaysFromNow.toISOString())

      // Total value
      const { data: valueData } = await this.supabase
        .from('opportunities')
        .select('value_amount')
        .eq('active', true)
        .not('value_amount', 'is', null)

      const totalValue = valueData?.reduce((sum, record) => {
        const avg = ((record.value_amount?.min || 0) + (record.value_amount?.max || 0)) / 2
        return sum + avg
      }, 0) || 0

      return {
        totalActive: totalActive || 0,
        matchingNaics: naicsCount,
        expiringSoon: expiringSoon || 0,
        totalValue,
        lastUpdated: new Date()
      }
    } catch (error) {
      throw new DatabaseError('Failed to get opportunity stats', error)
    }
  }
}