import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { ValidationError, AuthenticationError } from '@/lib/errors/types'
import { ComplianceExtractor } from '@/lib/compliance/extractor'
import { RequirementSection } from '@/types/compliance.types'

// Request validation schema
const extractComplianceSchema = z.object({
  opportunity_id: z.string().uuid('Invalid opportunity ID'),
  document_url: z.string().url('Invalid document URL'),
  document_type: z.enum(['rfp', 'rfi', 'rfq', 'sources_sought']).optional().default('rfp'),
  sections_to_extract: z.array(z.enum(['L', 'M', 'C', 'Other'])).optional().default(['L', 'M'])
})

export const POST = async (request: NextRequest) => {
  try {
  // Authenticate user
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthenticationError('Authentication required')
  }

  // Parse and validate request
  const body = await request.json()
  const validationResult = extractComplianceSchema.safeParse(body)
  
  if (!validationResult.success) {
    throw new ValidationError('Invalid request data', {
      errors: validationResult.error.flatten().fieldErrors
    })
  }

  const { opportunity_id, document_url, document_type, sections_to_extract } = validationResult.data

  // Verify user has access to the opportunity
  const { data: opportunity, error: oppError } = await supabase
    .from('opportunities')
    .select('id, title, notice_id')
    .eq('id', opportunity_id)
    .single()

  if (oppError || !opportunity) {
    throw new ValidationError('Opportunity not found or access denied')
  }

  // Create compliance matrix
  const { data: matrix, error: matrixError } = await supabase
    .from('compliance_matrices')
    .insert({
      opportunity_id,
      created_by: user.id,
      title: `Compliance Matrix - ${opportunity.title}`,
      rfp_document_url: document_url,
      status: 'draft',
      metadata: {
        document_type,
        extraction_started_at: new Date().toISOString(),
        sections_requested: sections_to_extract
      }
    })
    .select()
    .single()

  if (matrixError || !matrix) {
    throw new Error('Failed to create compliance matrix')
  }

  try {
    // Initialize compliance extractor
    const extractor = new ComplianceExtractor()
    
    // Extract requirements from document
    const extractionResult = await extractor.extractRequirements({
      document_url,
      document_type,
      sections: sections_to_extract as RequirementSection[],
      opportunity_context: {
        id: opportunity.id,
        title: opportunity.title,
        notice_id: opportunity.notice_id
      }
    })

    // Batch insert requirements
    if (extractionResult.requirements.length > 0) {
      const requirementsToInsert = extractionResult.requirements.map((req, index) => ({
        matrix_id: matrix.id,
        section: req.section,
        requirement_number: req.requirement_number,
        requirement_text: req.requirement_text,
        requirement_type: req.requirement_type,
        page_reference: req.page_reference,
        is_mandatory: req.is_mandatory,
        sort_order: index,
        extracted_metadata: {
          confidence_score: req.confidence_score,
          extraction_method: 'ai_assisted'
        }
      }))

      const { error: reqError } = await supabase
        .from('compliance_requirements')
        .insert(requirementsToInsert)

      if (reqError) {
        throw new Error('Failed to save requirements')
      }

      // Create default responses for each requirement
      const { data: insertedRequirements } = await supabase
        .from('compliance_requirements')
        .select('id')
        .eq('matrix_id', matrix.id)

      if (insertedRequirements && insertedRequirements.length > 0) {
        const responsesToInsert = insertedRequirements.map(req => ({
          requirement_id: req.id,
          response_status: 'not_started' as const
        }))

        await supabase
          .from('compliance_responses')
          .insert(responsesToInsert)
      }
    }

    // Update matrix metadata with extraction results
    await supabase
      .from('compliance_matrices')
      .update({
        status: 'in_progress',
        metadata: {
          ...matrix.metadata,
          extraction_completed_at: new Date().toISOString(),
          extraction_stats: extractionResult.extraction_metadata,
          total_requirements: extractionResult.requirements.length
        }
      })
      .eq('id', matrix.id)

    return NextResponse.json({
      success: true,
      data: {
        matrix_id: matrix.id,
        requirements: extractionResult.requirements,
        extraction_metadata: extractionResult.extraction_metadata
      }
    })

  } catch (error) {
    // Update matrix status to indicate extraction failure
    await supabase
      .from('compliance_matrices')
      .update({
        status: 'draft',
        metadata: {
          ...matrix.metadata,
          extraction_failed_at: new Date().toISOString(),
          extraction_error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      .eq('id', matrix.id)

    throw error
  }
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}