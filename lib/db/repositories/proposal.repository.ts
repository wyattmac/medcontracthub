/**
 * Proposal Repository
 * 
 * Handles all database operations for proposals including
 * sections, attachments, and document management
 * 
 * Uses Context7-based patterns for Supabase integration
 * Reference: /supabase/supabase - relational data patterns
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { BaseRepository, PaginatedResult } from './base.repository'
import { ProposalValidator } from '@/lib/validation/services/proposal-validator'
import { NotFoundError, ValidationError } from '@/lib/errors/types'
import { startSpan } from '@/lib/monitoring/performance'

type ProposalRow = Database['public']['Tables']['proposals']['Row']
type ProposalInsert = Database['public']['Tables']['proposals']['Insert']
type ProposalUpdate = Database['public']['Tables']['proposals']['Update']

type ProposalSectionRow = Database['public']['Tables']['proposal_sections']['Row']
type ProposalAttachmentRow = Database['public']['Tables']['proposal_attachments']['Row']

export interface ProposalWithDetails extends ProposalRow {
  opportunity?: {
    id: string
    title: string
    agency: string
    response_deadline: string
    solicitation_number?: string
  }
  sections?: ProposalSectionRow[]
  attachments?: ProposalAttachmentRow[]
  documents?: Array<{
    id: string
    document_name: string
    document_type: string
    processed: boolean
    extracted_text?: string
  }>
}

export interface ProposalCreateData {
  opportunity_id?: string
  title: string
  solicitation_number?: string
  submission_deadline?: string
  total_proposed_price?: number
  win_probability?: number
  proposal_summary?: string
  notes?: string
  tags?: string[]
  sections?: Array<{
    section_type: string
    title: string
    content?: string
    is_required?: boolean
    max_pages?: number
  }>
  attachedDocuments?: Array<{
    name: string
    size: number
    type: string
    url?: string
    extractedText?: string
  }>
}

export interface ProposalSearchParams {
  query?: string
  status?: 'draft' | 'submitted' | 'won' | 'lost'
  opportunityId?: string
  submissionDateStart?: Date
  submissionDateEnd?: Date
  tags?: string[]
}

export class ProposalRepository extends BaseRepository<'proposals', ProposalRow, ProposalInsert, ProposalUpdate> {
  private readonly detailSelect = `
    *,
    opportunities!proposals_opportunity_id_fkey(
      id,
      title,
      agency,
      response_deadline,
      solicitation_number
    ),
    proposal_sections(
      id,
      section_type,
      title,
      content,
      display_order,
      is_required,
      max_pages,
      created_at,
      updated_at
    ),
    proposal_attachments(
      id,
      file_name,
      file_type,
      file_size,
      file_url,
      description,
      uploaded_at
    ),
    proposal_documents!proposal_documents_proposal_id_fkey(
      id,
      document_id,
      contract_documents!inner(
        id,
        document_name,
        document_type,
        processed,
        extracted_text
      )
    )
  `

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'proposals')
  }

  /**
   * Create proposal with sections and attachments
   */
  async createWithDetails(
    userId: string,
    companyId: string,
    data: ProposalCreateData
  ): Promise<ProposalWithDetails> {
    const span = startSpan('ProposalRepository.createWithDetails')
    
    try {
      // Validate proposal data
      const validated = await ProposalValidator.validateProposalWithBusinessRules({
        ...data,
        user_id: userId,
        company_id: companyId,
        status: 'draft'
      })

      // Create proposal with related data in a transaction-like manner
      const proposal = await this.transaction(async (client) => {
        // Create main proposal
        const { data: newProposal, error: proposalError } = await client
          .from('proposals')
          .insert({
            user_id: userId,
            company_id: companyId,
            opportunity_id: validated.opportunity_id,
            title: validated.title,
            solicitation_number: validated.solicitation_number,
            submission_deadline: validated.submission_deadline,
            total_proposed_price: validated.total_proposed_price,
            win_probability: validated.win_probability,
            status: 'draft',
            proposal_summary: validated.proposal_summary,
            notes: validated.notes,
            tags: validated.tags || []
          })
          .select()
          .single()

        if (proposalError) {
          throw this.handleError(proposalError, 'createWithDetails.proposal', data)
        }

        // Create sections if provided
        if (data.sections && data.sections.length > 0) {
          const sections = data.sections.map((section, index) => ({
            proposal_id: newProposal.id,
            section_type: section.section_type,
            title: section.title,
            content: section.content || '',
            display_order: index + 1,
            is_required: section.is_required || false,
            max_pages: section.max_pages
          }))

          const { error: sectionsError } = await client
            .from('proposal_sections')
            .insert(sections)

          if (sectionsError) {
            throw this.handleError(sectionsError, 'createWithDetails.sections', {
              proposalId: newProposal.id,
              count: sections.length
            })
          }
        }

        // Create attachments if provided
        if (data.attachedDocuments && data.attachedDocuments.length > 0) {
          const attachments = data.attachedDocuments.map(doc => ({
            proposal_id: newProposal.id,
            file_name: doc.name,
            file_type: doc.type,
            file_size: doc.size,
            file_url: doc.url || '',
            description: doc.extractedText ? 'OCR processed document' : ''
          }))

          const { error: attachmentsError } = await client
            .from('proposal_attachments')
            .insert(attachments)

          if (attachmentsError) {
            throw this.handleError(attachmentsError, 'createWithDetails.attachments', {
              proposalId: newProposal.id,
              count: attachments.length
            })
          }
        }

        this.logger.info('Proposal created with details', {
          proposalId: newProposal.id,
          userId,
          companyId,
          sectionsCount: data.sections?.length || 0,
          attachmentsCount: data.attachedDocuments?.length || 0
        })

        return newProposal
      })

      // Fetch the complete proposal with all details
      const complete = await this.findByIdWithDetails(proposal.id)
      if (!complete) {
        throw new Error('Failed to fetch created proposal')
      }

      span?.setStatus('ok')
      return complete
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get proposal with all details
   */
  async findByIdWithDetails(id: string): Promise<ProposalWithDetails | null> {
    const span = startSpan('ProposalRepository.findByIdWithDetails')
    
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(this.detailSelect)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw this.handleError(error, 'findByIdWithDetails', { id })
      }

      // Transform the data structure
      const proposal: ProposalWithDetails = {
        ...data,
        opportunity: (data as any).opportunities,
        sections: (data as any).proposal_sections || [],
        attachments: (data as any).proposal_attachments || [],
        documents: ((data as any).proposal_documents || []).map((pd: any) => ({
          id: pd.contract_documents.id,
          document_name: pd.contract_documents.document_name,
          document_type: pd.contract_documents.document_type,
          processed: pd.contract_documents.processed,
          extracted_text: pd.contract_documents.extracted_text
        }))
      }

      span?.setStatus('ok')
      return proposal
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Search proposals with filters
   */
  async search(
    companyId: string,
    params: ProposalSearchParams,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResult<ProposalWithDetails>> {
    const span = startSpan('ProposalRepository.search')
    
    try {
      const offset = (page - 1) * pageSize

      let query = this.supabase
        .from(this.tableName)
        .select(this.detailSelect, { count: 'exact' })
        .eq('company_id', companyId)

      // Apply filters
      if (params.query) {
        query = query.or(`title.ilike.%${params.query}%,proposal_summary.ilike.%${params.query}%`)
      }

      if (params.status) {
        query = query.eq('status', params.status)
      }

      if (params.opportunityId) {
        query = query.eq('opportunity_id', params.opportunityId)
      }

      if (params.submissionDateStart) {
        query = query.gte('submission_deadline', params.submissionDateStart.toISOString())
      }

      if (params.submissionDateEnd) {
        query = query.lte('submission_deadline', params.submissionDateEnd.toISOString())
      }

      if (params.tags && params.tags.length > 0) {
        query = query.contains('tags', params.tags)
      }

      // Apply ordering and pagination
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      const { data, error, count } = await query

      if (error) {
        throw this.handleError(error, 'search', { companyId, params })
      }

      // Transform data
      const proposals = (data || []).map(item => ({
        ...item,
        opportunity: (item as any).opportunities,
        sections: (item as any).proposal_sections || [],
        attachments: (item as any).proposal_attachments || [],
        documents: ((item as any).proposal_documents || []).map((pd: any) => ({
          id: pd.contract_documents.id,
          document_name: pd.contract_documents.document_name,
          document_type: pd.contract_documents.document_type,
          processed: pd.contract_documents.processed,
          extracted_text: pd.contract_documents.extracted_text
        }))
      }))

      const total = count || 0
      const totalPages = Math.ceil(total / pageSize)

      span?.setStatus('ok')
      
      return {
        data: proposals,
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
   * Update proposal sections
   */
  async updateSections(
    proposalId: string,
    sections: Array<{
      id?: string
      section_type: string
      title: string
      content?: string
      is_required?: boolean
      max_pages?: number
    }>
  ): Promise<void> {
    const span = startSpan('ProposalRepository.updateSections')
    
    try {
      await this.transaction(async (client) => {
        // Delete existing sections
        const { error: deleteError } = await client
          .from('proposal_sections')
          .delete()
          .eq('proposal_id', proposalId)

        if (deleteError) {
          throw this.handleError(deleteError, 'updateSections.delete', { proposalId })
        }

        // Insert new sections
        if (sections.length > 0) {
          const newSections = sections.map((section, index) => ({
            proposal_id: proposalId,
            section_type: section.section_type,
            title: section.title,
            content: section.content || '',
            display_order: index + 1,
            is_required: section.is_required || false,
            max_pages: section.max_pages
          }))

          const { error: insertError } = await client
            .from('proposal_sections')
            .insert(newSections)

          if (insertError) {
            throw this.handleError(insertError, 'updateSections.insert', {
              proposalId,
              count: newSections.length
            })
          }
        }

        this.logger.info('Proposal sections updated', {
          proposalId,
          sectionsCount: sections.length
        })
      })

      span?.setStatus('ok')
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Add attachment to proposal
   */
  async addAttachment(
    proposalId: string,
    attachment: {
      file_name: string
      file_type: string
      file_size: number
      file_url: string
      description?: string
    }
  ): Promise<ProposalAttachmentRow> {
    const span = startSpan('ProposalRepository.addAttachment')
    
    try {
      const { data, error } = await this.supabase
        .from('proposal_attachments')
        .insert({
          proposal_id: proposalId,
          ...attachment
        })
        .select()
        .single()

      if (error) {
        throw this.handleError(error, 'addAttachment', { proposalId, attachment })
      }

      this.logger.info('Attachment added to proposal', {
        proposalId,
        attachmentId: data.id,
        fileName: attachment.file_name
      })

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
   * Link contract documents to proposal
   */
  async linkDocuments(
    proposalId: string,
    documentIds: string[]
  ): Promise<void> {
    const span = startSpan('ProposalRepository.linkDocuments')
    
    try {
      if (documentIds.length === 0) return

      const links = documentIds.map(docId => ({
        proposal_id: proposalId,
        document_id: docId
      }))

      const { error } = await this.supabase
        .from('proposal_documents')
        .insert(links)

      if (error) {
        throw this.handleError(error, 'linkDocuments', {
          proposalId,
          documentCount: documentIds.length
        })
      }

      this.logger.info('Documents linked to proposal', {
        proposalId,
        documentCount: documentIds.length
      })

      span?.setStatus('ok')
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Update proposal status
   */
  async updateStatus(
    id: string,
    status: 'draft' | 'submitted' | 'won' | 'lost',
    actualSubmissionDate?: Date
  ): Promise<ProposalRow> {
    const span = startSpan('ProposalRepository.updateStatus')
    
    try {
      const updates: ProposalUpdate = {
        status,
        ...(actualSubmissionDate && { actual_submission_date: actualSubmissionDate.toISOString() })
      }

      const updated = await super.update(id, updates)

      this.logger.info('Proposal status updated', {
        proposalId: id,
        status,
        hasSubmissionDate: !!actualSubmissionDate
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
   * Get proposal statistics for a company
   */
  async getStatistics(companyId: string): Promise<{
    total: number
    byStatus: Record<string, number>
    averageWinRate: number
    totalValue: number
    recentActivity: Array<{
      id: string
      title: string
      status: string
      updated_at: string
    }>
  }> {
    const span = startSpan('ProposalRepository.getStatistics')
    
    try {
      // Get all proposals for statistics
      const { data: proposals, error } = await this.supabase
        .from(this.tableName)
        .select('id, title, status, win_probability, total_proposed_price, updated_at')
        .eq('company_id', companyId)

      if (error) {
        throw this.handleError(error, 'getStatistics', { companyId })
      }

      const allProposals = proposals || []

      // Calculate statistics
      const byStatus: Record<string, number> = {}
      let totalWinProbability = 0
      let totalValue = 0
      let winProbabilityCount = 0

      allProposals.forEach(proposal => {
        // Status counts
        byStatus[proposal.status] = (byStatus[proposal.status] || 0) + 1

        // Win probability average
        if (proposal.win_probability !== null) {
          totalWinProbability += proposal.win_probability
          winProbabilityCount++
        }

        // Total value
        if (proposal.total_proposed_price) {
          totalValue += proposal.total_proposed_price
        }
      })

      // Recent activity (last 5)
      const recentActivity = allProposals
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5)
        .map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          updated_at: p.updated_at
        }))

      span?.setStatus('ok')
      
      return {
        total: allProposals.length,
        byStatus,
        averageWinRate: winProbabilityCount > 0 
          ? (totalWinProbability / winProbabilityCount) * 100
          : 0,
        totalValue,
        recentActivity
      }
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'getStatistics', { companyId })
    } finally {
      span?.finish()
    }
  }

  /**
   * Find proposals by company with filters and pagination
   */
  async findByCompany(
    companyId: string,
    options?: {
      page?: number
      pageSize?: number
      status?: string
      statuses?: string[]
      orderBy?: string
    }
  ): Promise<PaginatedResult<ProposalRow>> {
    const span = startSpan('ProposalRepository.findByCompany')
    
    try {
      let query = this.supabase
        .from('proposals')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)

      // Apply status filter
      if (options?.status) {
        query = query.eq('status', options.status)
      } else if (options?.statuses?.length) {
        query = query.in('status', options.statuses)
      }

      // Apply ordering
      if (options?.orderBy === 'deadline') {
        query = query.order('submission_deadline', { ascending: true })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      return this.findPaginated({
        filters: { company_id: companyId },
        page: options?.page || 1,
        pageSize: options?.pageSize || 20
      })
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'findByCompany', { companyId })
    } finally {
      span?.finish()
    }
  }

  /**
   * Create proposal with sections
   */
  async createWithSections(
    proposalData: ProposalInsert,
    sections: Array<{
      section_type: string
      title: string
      content?: string
      display_order: number
      is_required?: boolean
      max_pages?: number
    }>
  ): Promise<ProposalWithDetails> {
    const span = startSpan('ProposalRepository.createWithSections')
    
    try {
      // Validate proposal
      const validated = await ProposalValidator.validateProposal(proposalData)

      return await this.transaction(async (client) => {
        // Create proposal
        const proposal = await this.create(validated)

        // Create sections
        if (sections.length > 0) {
          const { error: sectionsError } = await client
            .from('proposal_sections')
            .insert(
              sections.map(section => ({
                ...section,
                proposal_id: proposal.id
              }))
            )

          if (sectionsError) throw sectionsError
        }

        // Return with details
        return await this.findByIdWithDetails(proposal.id)
      })
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'createWithSections')
    } finally {
      span?.finish()
    }
  }

  /**
   * Update a proposal section
   */
  async updateSection(
    proposalId: string,
    sectionId: string,
    updates: {
      title?: string
      content?: string
    }
  ): Promise<ProposalSectionRow> {
    const span = startSpan('ProposalRepository.updateSection')
    
    try {
      // Validate section data
      if (updates.content) {
        await ProposalValidator.validateSection(updates)
      }

      const { data, error } = await this.supabase
        .from('proposal_sections')
        .update(updates)
        .eq('id', sectionId)
        .eq('proposal_id', proposalId)
        .select()
        .single()

      if (error) throw error
      if (!data) throw new NotFoundError('Section not found')

      return data
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'updateSection', { proposalId, sectionId })
    } finally {
      span?.finish()
    }
  }

  /**
   * Reorder proposal sections
   */
  async reorderSections(
    proposalId: string,
    sectionOrders: Array<{ id: string; display_order: number }>
  ): Promise<void> {
    const span = startSpan('ProposalRepository.reorderSections')
    
    try {
      // Update each section's display order
      for (const { id, display_order } of sectionOrders) {
        const { error } = await this.supabase
          .from('proposal_sections')
          .update({ display_order })
          .eq('id', id)
          .eq('proposal_id', proposalId)

        if (error) throw error
      }
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'reorderSections', { proposalId })
    } finally {
      span?.finish()
    }
  }

  /**
   * Update proposal status
   */
  async updateStatus(
    proposalId: string,
    status: 'draft' | 'submitted' | 'won' | 'lost'
  ): Promise<ProposalRow> {
    const span = startSpan('ProposalRepository.updateStatus')
    
    try {
      const updates: ProposalUpdate = { status }

      // Set submission date when status changes to submitted
      if (status === 'submitted') {
        updates.actual_submission_date = new Date().toISOString()
      } else if (status === 'draft') {
        updates.actual_submission_date = null
      }

      // Validate status transition
      await ProposalValidator.validateProposal({ status })

      return await this.update(proposalId, updates)
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'updateStatus', { proposalId, status })
    } finally {
      span?.finish()
    }
  }

  /**
   * Get proposal statistics by company
   */
  async getStatisticsByCompany(companyId: string): Promise<{
    total: number
    byStatus: {
      draft: number
      submitted: number
      won: number
      lost: number
    }
    winRate: number
    avgTimeToSubmit: number
    avgProposalValue: number
  }> {
    const span = startSpan('ProposalRepository.getStatisticsByCompany')
    
    try {
      // Get counts by status
      const statuses = ['draft', 'submitted', 'won', 'lost'] as const
      const byStatus: any = {}

      const totalCount = await this.count({ company_id: companyId })

      for (const status of statuses) {
        const count = await this.count({ company_id: companyId, status })
        byStatus[status] = count
      }

      // Calculate win rate
      const totalCompleted = byStatus.won + byStatus.lost
      const winRate = totalCompleted > 0 ? (byStatus.won / totalCompleted) * 100 : 0

      // Get average time to submit
      const { data: submittedProposals } = await this.supabase
        .from('proposals')
        .select('created_at, actual_submission_date')
        .eq('company_id', companyId)
        .eq('status', 'submitted')
        .not('actual_submission_date', 'is', null)

      let avgTimeToSubmit = 0
      if (submittedProposals?.length) {
        const totalDays = submittedProposals.reduce((sum, p) => {
          const created = new Date(p.created_at)
          const submitted = new Date(p.actual_submission_date!)
          const days = (submitted.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
          return sum + days
        }, 0)
        avgTimeToSubmit = totalDays / submittedProposals.length
      }

      // Get average proposal value
      const { data: avgData } = await this.supabase
        .from('proposals')
        .select('total_proposed_price')
        .eq('company_id', companyId)
        .not('total_proposed_price', 'is', null)

      const avgProposalValue = avgData?.length
        ? avgData.reduce((sum, p) => sum + (p.total_proposed_price || 0), 0) / avgData.length
        : 0

      return {
        total: totalCount,
        byStatus,
        winRate,
        avgTimeToSubmit,
        avgProposalValue
      }
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'getStatisticsByCompany', { companyId })
    } finally {
      span?.finish()
    }
  }

  /**
   * Find proposals with upcoming deadlines
   */
  async findExpiringProposals(
    daysAhead: number,
    companyId?: string
  ): Promise<ProposalRow[]> {
    const span = startSpan('ProposalRepository.findExpiringProposals')
    
    try {
      const now = new Date()
      const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000))

      let query = this.supabase
        .from('proposals')
        .select('*')
        .eq('status', 'draft')
        .not('submission_deadline', 'is', null)
        .gte('submission_deadline', now.toISOString())
        .lte('submission_deadline', futureDate.toISOString())
        .order('submission_deadline', { ascending: true })

      if (companyId) {
        query = query.eq('company_id', companyId)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'findExpiringProposals', { daysAhead, companyId })
    } finally {
      span?.finish()
    }
  }

  /**
   * Duplicate a proposal
   */
  async duplicateProposal(
    proposalId: string,
    userId: string
  ): Promise<ProposalWithDetails> {
    const span = startSpan('ProposalRepository.duplicateProposal')
    
    try {
      // Get original proposal with sections
      const original = await this.findByIdWithDetails(proposalId)
      if (!original) throw new NotFoundError('Proposal not found')

      return await this.transaction(async (client) => {
        // Create new proposal
        const { data: newProposal, error: proposalError } = await client
          .from('proposals')
          .insert({
            ...original,
            id: undefined,
            title: `Copy of ${original.title}`,
            status: 'draft',
            actual_submission_date: null,
            user_id: userId,
            created_at: undefined,
            updated_at: undefined
          })
          .select()
          .single()

        if (proposalError) throw proposalError

        // Copy sections
        if (original.sections?.length) {
          const { error: sectionsError } = await client
            .from('proposal_sections')
            .insert(
              original.sections.map(section => ({
                ...section,
                id: undefined,
                proposal_id: newProposal.id,
                created_at: undefined,
                updated_at: undefined
              }))
            )

          if (sectionsError) throw sectionsError
        }

        return await this.findByIdWithDetails(newProposal.id)
      })
    } catch (error) {
      span?.setStatus('error')
      throw this.handleError(error, 'duplicateProposal', { proposalId, userId })
    } finally {
      span?.finish()
    }
  }
}