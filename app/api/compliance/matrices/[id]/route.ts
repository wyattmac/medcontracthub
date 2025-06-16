import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { ValidationError, AuthenticationError, NotFoundError } from '@/lib/errors/types'

// Request validation schemas
const updateMatrixSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  status: z.enum(['draft', 'in_progress', 'completed', 'archived']).optional(),
  rfp_document_url: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
})

interface RouteParams {
  params: {
    id: string
  }
}

// GET /api/compliance/matrices/[id] - Get single compliance matrix with requirements
export const GET = async (request: NextRequest, { params }: RouteParams) => {
  try {
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthenticationError('Authentication required')
  }

  const matrixId = params.id
  if (!matrixId || !z.string().uuid().safeParse(matrixId).success) {
    throw new ValidationError('Invalid matrix ID')
  }

  // Fetch matrix with all related data
  const { data: matrix, error } = await supabase
    .from('compliance_matrices')
    .select(`
      *,
      opportunity:opportunities(
        id, 
        title, 
        notice_id, 
        type, 
        posted_date,
        response_deadline,
        place_of_performance_state,
        place_of_performance_city
      ),
      creator:users!created_by(id, name, email)
    `)
    .eq('id', matrixId)
    .single()

  if (error || !matrix) {
    throw new NotFoundError('Compliance matrix not found')
  }

  // Fetch requirements with responses
  const { data: requirements, error: reqError } = await supabase
    .from('compliance_requirements')
    .select(`
      *,
      response:compliance_responses(
        *,
        assigned_user:users!assigned_to(id, name, email)
      )
    `)
    .eq('matrix_id', matrixId)
    .order('sort_order', { ascending: true })

  if (reqError) {
    throw new Error('Failed to fetch requirements')
  }

  // Structure requirements hierarchically
  const structuredRequirements = buildRequirementTree(requirements || [])

  // Calculate completion stats
  const allResponses = (requirements || []).map(r => r.response).filter(Boolean).flat()
  const totalRequirements = requirements?.length || 0
  const completedRequirements = allResponses.filter(r => r.response_status === 'completed').length
  const inProgressRequirements = allResponses.filter(r => r.response_status === 'in_progress').length

  return NextResponse.json({
    success: true,
    data: {
      ...matrix,
      requirements: structuredRequirements,
      total_requirements: totalRequirements,
      completed_requirements: completedRequirements,
      in_progress_requirements: inProgressRequirements,
      completion_percentage: totalRequirements > 0 
        ? Math.round((completedRequirements / totalRequirements) * 100)
        : 0
    }
  })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/compliance/matrices/[id] - Update compliance matrix
export const PUT = async (request: NextRequest, { params }: RouteParams) => {
  try {
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthenticationError('Authentication required')
  }

  const matrixId = params.id
  if (!matrixId || !z.string().uuid().safeParse(matrixId).success) {
    throw new ValidationError('Invalid matrix ID')
  }

  const body = await request.json()
  const validationResult = updateMatrixSchema.safeParse(body)
  
  if (!validationResult.success) {
    throw new ValidationError('Invalid request data', {
      errors: validationResult.error.flatten().fieldErrors
    })
  }

  // Verify matrix exists and user has access
  const { data: existingMatrix } = await supabase
    .from('compliance_matrices')
    .select('id')
    .eq('id', matrixId)
    .single()

  if (!existingMatrix) {
    throw new NotFoundError('Compliance matrix not found')
  }

  const updateData = validationResult.data
  
  // Update matrix
  const { data: updatedMatrix, error: updateError } = await supabase
    .from('compliance_matrices')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', matrixId)
    .select(`
      *,
      opportunity:opportunities(id, title, notice_id, type),
      creator:users!created_by(id, name, email)
    `)
    .single()

  if (updateError || !updatedMatrix) {
    throw new Error('Failed to update compliance matrix')
  }

  return NextResponse.json({
    success: true,
    data: updatedMatrix
  })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/compliance/matrices/[id] - Delete compliance matrix
export const DELETE = async (request: NextRequest, { params }: RouteParams) => {
  try {
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthenticationError('Authentication required')
  }

  const matrixId = params.id
  if (!matrixId || !z.string().uuid().safeParse(matrixId).success) {
    throw new ValidationError('Invalid matrix ID')
  }

  // Verify matrix exists and user has access
  const { data: existingMatrix } = await supabase
    .from('compliance_matrices')
    .select('id, created_by')
    .eq('id', matrixId)
    .single()

  if (!existingMatrix) {
    throw new NotFoundError('Compliance matrix not found')
  }

  // Delete matrix (cascades to requirements and responses)
  const { error: deleteError } = await supabase
    .from('compliance_matrices')
    .delete()
    .eq('id', matrixId)

  if (deleteError) {
    throw new Error('Failed to delete compliance matrix')
  }

  return NextResponse.json({
    success: true,
    message: 'Compliance matrix deleted successfully'
  })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to build hierarchical requirement tree
function buildRequirementTree(requirements: any[]): any[] {
  const requirementMap = new Map()
  const rootRequirements: any[] = []

  // First pass: create map of all requirements
  requirements.forEach(req => {
    requirementMap.set(req.id, { ...req, children: [] })
  })

  // Second pass: build tree structure
  requirements.forEach(req => {
    const requirement = requirementMap.get(req.id)
    if (req.parent_requirement_id) {
      const parent = requirementMap.get(req.parent_requirement_id)
      if (parent) {
        parent.children.push(requirement)
      }
    } else {
      rootRequirements.push(requirement)
    }
  })

  return rootRequirements
}