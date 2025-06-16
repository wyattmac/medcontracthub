import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { ValidationError, AuthenticationError, NotFoundError } from '@/lib/errors/types'

// Request validation schemas
const updateResponseSchema = z.object({
  response_status: z.enum(['not_started', 'in_progress', 'completed', 'not_applicable', 'deferred']).optional(),
  proposal_section: z.string().optional(),
  response_location: z.string().optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable()
})

interface RouteParams {
  params: {
    id: string
  }
}

// PUT /api/compliance/responses/[id] - Update compliance response
export const PUT = async (request: NextRequest, { params }: RouteParams) => {
  try {
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthenticationError('Authentication required')
  }

  const responseId = params.id
  if (!responseId || !z.string().uuid().safeParse(responseId).success) {
    throw new ValidationError('Invalid response ID')
  }

  const body = await request.json()
  const validationResult = updateResponseSchema.safeParse(body)
  
  if (!validationResult.success) {
    throw new ValidationError('Invalid request data', {
      errors: validationResult.error.flatten().fieldErrors
    })
  }

  // Verify response exists and user has access
  const { data: existingResponse } = await supabase
    .from('compliance_responses')
    .select(`
      id,
      requirement:compliance_requirements!inner(
        matrix:compliance_matrices!inner(
          created_by,
          opportunity:opportunities!inner(id)
        )
      )
    `)
    .eq('id', responseId)
    .single()

  if (!existingResponse) {
    throw new NotFoundError('Compliance response not found')
  }

  // Prepare update data
  const updateData: any = { ...validationResult.data }
  
  // If status is being set to completed, update completed_at
  if (updateData.response_status === 'completed' && updateData.response_status !== existingResponse.response_status) {
    updateData.completed_at = new Date().toISOString()
  } else if (updateData.response_status !== 'completed') {
    updateData.completed_at = null
  }

  // Update response
  const { data: updatedResponse, error: updateError } = await supabase
    .from('compliance_responses')
    .update(updateData)
    .eq('id', responseId)
    .select(`
      *,
      requirement:compliance_requirements(
        id,
        section,
        requirement_number,
        requirement_text
      ),
      assigned_user:users!assigned_to(id, name, email)
    `)
    .single()

  if (updateError || !updatedResponse) {
    throw new Error('Failed to update compliance response')
  }

  // Update matrix metadata if status changed
  if (validationResult.data.response_status) {
    // Get all responses for this matrix to calculate completion stats
    const { data: matrixRequirements } = await supabase
      .from('compliance_requirements')
      .select('id')
      .eq('matrix_id', existingResponse.requirement.matrix.id)

    if (matrixRequirements) {
      const { data: allResponses } = await supabase
        .from('compliance_responses')
        .select('response_status')
        .in('requirement_id', matrixRequirements.map(r => r.id))

      const completedCount = allResponses?.filter(r => r.response_status === 'completed').length || 0
      const totalCount = matrixRequirements.length

      // Update matrix metadata
      await supabase
        .from('compliance_matrices')
        .update({
          metadata: {
            total_requirements: totalCount,
            completed_requirements: completedCount,
            completion_percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
            last_updated: new Date().toISOString()
          }
        })
        .eq('id', existingResponse.requirement.matrix.id)
    }
  }

  return NextResponse.json({
    success: true,
    data: updatedResponse
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