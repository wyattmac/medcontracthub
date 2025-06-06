/**
 * OCR Document Processing API Route
 * POST /api/ocr/process
 * 
 * Processes documents from SAM.gov opportunities using Mistral OCR
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler'
import { SAMDocumentProcessor } from '@/lib/sam-gov/document-processor'
import { DatabaseError, NotFoundError } from '@/lib/errors/types'
import { syncLogger } from '@/lib/errors/logger'
import { withUsageCheck } from '@/lib/usage/tracker'

// Request validation schema
const processRequestSchema = z.object({
  opportunityId: z.string().uuid(),
  processAllDocuments: z.boolean().default(true),
  documentIndices: z.array(z.number()).optional()
})

export const POST = routeHandler.POST(
  async ({ request, user, supabase }) => {
    const body = await request.json()
    const { opportunityId, processAllDocuments, documentIndices } = processRequestSchema.parse(body)

    // Check if opportunity exists and belongs to user's saved opportunities
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        saved_opportunities!inner(id)
      `)
      .eq('id', opportunityId)
      .eq('saved_opportunities.user_id', user.id)
      .single()

    if (oppError || !opportunity) {
      throw new NotFoundError('Opportunity not found or not saved')
    }

    // Check if opportunity has resource links
    const resourceLinks = opportunity.additional_info?.resourceLinks || []
    if (resourceLinks.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No documents found for this opportunity',
        documentsProcessed: 0
      })
    }

    // Filter documents to process
    let linksToProcess = resourceLinks
    if (!processAllDocuments && documentIndices) {
      linksToProcess = documentIndices
        .filter(i => i >= 0 && i < resourceLinks.length)
        .map(i => resourceLinks[i])
    }

    syncLogger.info('Starting document processing', {
      opportunityId,
      totalDocuments: resourceLinks.length,
      documentsToProcess: linksToProcess.length
    })

    // Initialize document processor
    const processor = new SAMDocumentProcessor()

    try {
      // Process documents with usage tracking
      const results = await withUsageCheck(
        user.id,
        'ocr_document',
        linksToProcess.length,
        async () => {
          return await processor.processOpportunityDocuments(
            opportunityId,
            linksToProcess,
            process.env.SAM_GOV_API_KEY!
          )
        }
      )

      // Calculate summary statistics
      const totalRequirements = results.reduce((sum, doc) => sum + doc.requirements.length, 0)
      const avgProcessingTime = results.length > 0 
        ? results.reduce((sum, doc) => sum + doc.processingTime, 0) / results.length 
        : 0

      // Create sourcing report
      const { data: report, error: reportError } = await supabase
        .from('sourcing_reports')
        .insert({
          opportunity_id: opportunityId,
          company_id: user.company_id,
          document_id: results[0]?.documentId, // Link to first document
          total_requirements: totalRequirements,
          requirements_sourced: 0, // Will be updated as products are sourced
          report_data: {
            processedDocuments: results.map(r => ({
              documentId: r.documentId,
              fileName: r.fileName,
              requirementsFound: r.requirements.length,
              processingTimeMs: r.processingTime
            })),
            processingStarted: new Date().toISOString(),
            avgProcessingTimeMs: avgProcessingTime
          }
        })
        .select()
        .single()

      if (reportError) {
        syncLogger.error('Failed to create sourcing report', reportError)
      }

      return NextResponse.json({
        success: true,
        message: `Successfully processed ${results.length} documents`,
        documentsProcessed: results.length,
        totalRequirements,
        avgProcessingTimeMs: Math.round(avgProcessingTime),
        reportId: report?.id,
        results: results.map(r => ({
          documentId: r.documentId,
          fileName: r.fileName,
          requirementsFound: r.requirements.length,
          processingTimeMs: r.processingTime
        }))
      })

    } catch (error) {
      syncLogger.error('Document processing failed', error as Error, { opportunityId })
      throw new DatabaseError('Failed to process documents', undefined, error)
    }
  },
  { 
    requireAuth: true,
    rateLimit: 'api' // OCR processing is resource-intensive
  }
)