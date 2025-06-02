import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler, IRouteContext, createPaginatedResponse } from '@/lib/api/route-handler'
import { DatabaseError, NotFoundError } from '@/lib/errors/types'
import { dbLogger } from '@/lib/errors/logger'

// Query validation schemas
const getProposalsSchema = z.object({
  status: z.enum(['draft', 'submitted', 'won', 'lost', 'withdrawn']).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('10'),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default('0')
})

export const GET = routeHandler.GET(
  async ({ request, user, supabase }: IRouteContext) => {
    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams
    const queryData = Object.fromEntries(searchParams)
    const { status, limit, offset } = getProposalsSchema.parse(queryData)

    // Get user's company ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      dbLogger.error('Failed to fetch user profile', profileError)
      throw new DatabaseError('Failed to fetch user profile')
    }

    if (!profile?.company_id) {
      throw new NotFoundError('Company profile')
    }

    // Build query
    let query = supabase
      .from('proposals')
      .select(`
        *,
        opportunities (
          id,
          title,
          solicitation_number,
          response_deadline,
          agency
        ),
        proposal_sections (
          id,
          section_type,
          title,
          word_count
        )
      `)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: proposals, error } = await query

    if (error) {
      dbLogger.error('Error fetching proposals', error, { status, limit, offset })
      throw new DatabaseError('Failed to fetch proposals', undefined, error)
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', profile.company_id)

    if (status) {
      countQuery = countQuery.eq('status', status)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      dbLogger.warn('Failed to get proposal count', countError)
    }

    return createPaginatedResponse(proposals || [], {
      offset,
      limit,
      total: count || 0
    })
  },
  {
    requireAuth: true,
    validateQuery: getProposalsSchema
  }
)

// Create proposal schema
const createProposalSchema = z.object({
  opportunity_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  solicitation_number: z.string().optional(),
  submission_deadline: z.string().datetime().optional(),
  total_proposed_price: z.number().positive().optional(),
  proposal_summary: z.string().optional(),
  win_probability: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sections: z.array(z.object({
    section_type: z.string(),
    title: z.string(),
    content: z.string().optional(),
    is_required: z.boolean().optional(),
    max_pages: z.number().positive().optional()
  })).optional()
})

export const POST = routeHandler.POST(
  async ({ request, user, supabase }: IRouteContext) => {
    const body = await request.json()
    const validatedData = createProposalSchema.parse(body)

    // Get user's company ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      dbLogger.error('Failed to fetch user profile', profileError)
      throw new DatabaseError('Failed to fetch user profile')
    }

    if (!profile?.company_id) {
      throw new NotFoundError('Company profile')
    }

    // Verify opportunity exists
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select('id')
      .eq('id', validatedData.opportunity_id)
      .single()

    if (oppError || !opportunity) {
      throw new NotFoundError('Opportunity')
    }

    // Create proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .insert({
        opportunity_id: validatedData.opportunity_id,
        company_id: profile.company_id,
        created_by: user.id,
        title: validatedData.title,
        solicitation_number: validatedData.solicitation_number,
        submission_deadline: validatedData.submission_deadline,
        total_proposed_price: validatedData.total_proposed_price,
        proposal_summary: validatedData.proposal_summary,
        win_probability: validatedData.win_probability,
        notes: validatedData.notes,
        tags: validatedData.tags || [],
        status: 'draft'
      })
      .select()
      .single()

    if (proposalError) {
      dbLogger.error('Error creating proposal', proposalError)
      throw new DatabaseError('Failed to create proposal', undefined, proposalError)
    }

    // Create default sections if provided
    if (validatedData.sections && validatedData.sections.length > 0) {
      const sectionsToInsert = validatedData.sections.map((section, index) => ({
        proposal_id: proposal.id,
        section_type: section.section_type,
        title: section.title,
        content: section.content || '',
        sort_order: index,
        is_required: section.is_required || false,
        max_pages: section.max_pages || null
      }))

      const { error: sectionsError } = await supabase
        .from('proposal_sections')
        .insert(sectionsToInsert)

      if (sectionsError) {
        dbLogger.warn('Error creating proposal sections', sectionsError)
        // Don't fail the whole request, just log the error
      }
    }

    // Log audit
    supabase.rpc('log_audit', {
      p_action: 'create_proposal',
      p_entity_type: 'proposals',
      p_entity_id: proposal.id,
      p_changes: { title: proposal.title }
    }).catch((error: any) => {
      dbLogger.warn('Failed to log proposal creation', error)
    })

    return NextResponse.json({ proposal }, { status: 201 })
  },
  {
    requireAuth: true,
    validateBody: createProposalSchema
  }
)