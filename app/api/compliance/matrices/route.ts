import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api/error-interceptor'
import { z } from 'zod'
import { ValidationError, UnauthorizedError } from '@/lib/errors/types'

// Request validation schemas
const createMatrixSchema = z.object({
  opportunity_id: z.string().uuid('Invalid opportunity ID'),
  title: z.string().min(3).max(255),
  rfp_document_url: z.string().url().optional()
})

const listMatricesSchema = z.object({
  opportunity_id: z.string().uuid().optional(),
  status: z.array(z.enum(['draft', 'in_progress', 'completed', 'archived'])).optional(),
  page: z.number().int().positive().default(1),
  page_size: z.number().int().positive().max(100).default(20)
})

// GET /api/compliance/matrices - List compliance matrices
export const GET = withErrorHandler(async (request: NextRequest) => {
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new UnauthorizedError('Authentication required')
  }

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams
  const params = {
    opportunity_id: searchParams.get('opportunity_id') || undefined,
    status: searchParams.getAll('status'),
    page: parseInt(searchParams.get('page') || '1'),
    page_size: parseInt(searchParams.get('page_size') || '20')
  }

  const validationResult = listMatricesSchema.safeParse(params)
  if (!validationResult.success) {
    throw new ValidationError('Invalid query parameters', {
      errors: validationResult.error.flatten().fieldErrors
    })
  }

  const { opportunity_id, status, page, page_size } = validationResult.data
  const offset = (page - 1) * page_size

  // Build query
  let query = supabase
    .from('compliance_matrices')
    .select(`
      *,
      opportunity:opportunities(id, title, notice_id, type),
      creator:users!created_by(id, name, email),
      requirements:compliance_requirements(count)
    `, { count: 'exact' })

  if (opportunity_id) {
    query = query.eq('opportunity_id', opportunity_id)
  }

  if (status && status.length > 0) {
    query = query.in('status', status)
  }

  // Execute query with pagination
  const { data: matrices, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + page_size - 1)

  if (error) {
    throw new Error('Failed to fetch compliance matrices')
  }

  // Add completion stats
  const matricesWithStats = await Promise.all(
    (matrices || []).map(async (matrix) => {
      const { data: stats } = await supabase
        .from('compliance_responses')
        .select('response_status')
        .in('requirement_id', 
          await supabase
            .from('compliance_requirements')
            .select('id')
            .eq('matrix_id', matrix.id)
            .then(res => res.data?.map(r => r.id) || [])
        )

      const totalRequirements = matrix.requirements?.[0]?.count || 0
      const completedRequirements = stats?.filter(s => s.response_status === 'completed').length || 0

      return {
        ...matrix,
        total_requirements: totalRequirements,
        completed_requirements: completedRequirements,
        completion_percentage: totalRequirements > 0 
          ? Math.round((completedRequirements / totalRequirements) * 100)
          : 0
      }
    })
  )

  return NextResponse.json({
    success: true,
    data: matricesWithStats,
    pagination: {
      page,
      page_size,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / page_size)
    }
  })
})

// POST /api/compliance/matrices - Create new compliance matrix
export const POST = withErrorHandler(async (request: NextRequest) => {
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new UnauthorizedError('Authentication required')
  }

  const body = await request.json()
  const validationResult = createMatrixSchema.safeParse(body)
  
  if (!validationResult.success) {
    throw new ValidationError('Invalid request data', {
      errors: validationResult.error.flatten().fieldErrors
    })
  }

  const { opportunity_id, title, rfp_document_url } = validationResult.data

  // Verify access to opportunity
  const { data: opportunity, error: oppError } = await supabase
    .from('opportunities')
    .select('id, title')
    .eq('id', opportunity_id)
    .single()

  if (oppError || !opportunity) {
    throw new ValidationError('Opportunity not found or access denied')
  }

  // Create matrix
  const { data: matrix, error: createError } = await supabase
    .from('compliance_matrices')
    .insert({
      opportunity_id,
      created_by: user.id,
      title,
      rfp_document_url,
      status: 'draft',
      metadata: {
        created_from: 'manual',
        created_at: new Date().toISOString()
      }
    })
    .select(`
      *,
      opportunity:opportunities(id, title, notice_id, type),
      creator:users!created_by(id, name, email)
    `)
    .single()

  if (createError || !matrix) {
    throw new Error('Failed to create compliance matrix')
  }

  return NextResponse.json({
    success: true,
    data: {
      ...matrix,
      total_requirements: 0,
      completed_requirements: 0,
      completion_percentage: 0
    }
  }, { status: 201 })
}, {
  requireAuth: true,
  rateLimit: {
    requests: 30,
    windowMs: 60 * 1000 // 30 per minute
  }
})