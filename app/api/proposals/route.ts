import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler, IRouteContext, createPaginatedResponse } from '@/lib/api/route-handler'
import { DatabaseError, NotFoundError } from '@/lib/errors/types'
import { dbLogger } from '@/lib/errors/logger'
import { 
  uuidSchema, 
  limitSchema, 
  offsetSchema,
  proposalStatusSchema,
  ProposalValidator 
} from '@/lib/validation'
import { formatZodError } from '@/lib/validation/error-formatter'

// Query validation schemas using shared schemas
const getProposalsSchema = z.object({
  status: proposalStatusSchema.optional(),
  limit: limitSchema,
  offset: offsetSchema
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

// Create proposal schema with enhanced validation
const createProposalSchema = z.object({
  opportunity_id: uuidSchema,
  title: z.string().min(1, 'Proposal title is required').max(255, 'Title must be less than 255 characters'),
  solicitation_number: z.string().optional(),
  submission_deadline: z.string().datetime('Invalid deadline format').optional(),
  total_proposed_price: z.number().positive('Price must be positive').optional(),
  proposal_summary: z.string().max(2000, 'Summary must be less than 2000 characters').optional(),
  win_probability: z.number().min(0, 'Probability must be at least 0%').max(100, 'Probability must be at most 100%').optional(),
  notes: z.string().max(5000, 'Notes must be less than 5000 characters').optional(),
  tags: z.array(z.string().max(50, 'Tag must be less than 50 characters')).max(20, 'Maximum 20 tags allowed').optional(),
  sections: z.array(z.object({
    section_type: z.string().min(1, 'Section type is required'),
    title: z.string().min(1, 'Section title is required').max(200, 'Title must be less than 200 characters'),
    content: z.string().optional(),
    is_required: z.boolean().optional(),
    max_pages: z.number().positive('Page limit must be positive').optional()
  })).optional(),
  attachedDocuments: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, 'Document name is required'),
    size: z.number().positive('File size must be positive'),
    type: z.string().min(1, 'File type is required'),
    url: z.string().url('Invalid document URL').optional(),
    extractedText: z.string().optional()
  })).max(10, 'Maximum 10 documents allowed').optional()
}).refine((data) => {
  // If submission deadline is provided, it must be in the future
  if (data.submission_deadline) {
    return new Date(data.submission_deadline) > new Date()
  }
  return true
}, {
  message: 'Submission deadline must be in the future',
  path: ['submission_deadline']
})

export const POST = routeHandler.POST(
  async ({ request, user, supabase }: IRouteContext) => {
    const body = await request.json()
    
    // Use enhanced validation with better error messages
    let validatedData
    try {
      validatedData = createProposalSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formatted = formatZodError(error)
        return NextResponse.json(formatted, { status: 400 })
      }
      throw error
    }

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

    // Verify opportunity exists and get deadline
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select('id, response_deadline')
      .eq('id', validatedData.opportunity_id)
      .single()

    if (oppError || !opportunity) {
      throw new NotFoundError('Opportunity')
    }

    // Additional business validation
    const proposalData = {
      opportunityId: validatedData.opportunity_id,
      title: validatedData.title,
      status: 'draft',
      sections: validatedData.sections?.map(s => ({
        id: crypto.randomUUID(),
        title: s.title,
        content: s.content || '',
        wordCount: s.content?.split(/\s+/).length || 0,
        required: s.is_required || false
      })) || [],
      dueDate: validatedData.submission_deadline || opportunity.response_deadline
    }

    // Validate with business rules
    await ProposalValidator.validateWithBusinessRules(proposalData)

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

    // Store document attachments if provided
    if (validatedData.attachedDocuments && validatedData.attachedDocuments.length > 0) {
      const documentsToInsert = validatedData.attachedDocuments.map((doc) => ({
        proposal_id: proposal.id,
        document_name: doc.name,
        document_size: doc.size,
        document_type: doc.type,
        document_url: doc.url,
        extracted_text: doc.extractedText,
        uploaded_by: user.id,
        created_at: new Date().toISOString()
      }))

      const { error: documentsError } = await supabase
        .from('proposal_documents')
        .insert(documentsToInsert)

      if (documentsError) {
        dbLogger.warn('Error storing proposal documents', documentsError)
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