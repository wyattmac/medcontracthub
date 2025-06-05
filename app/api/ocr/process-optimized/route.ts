/**
 * Optimized OCR Document Processing API Route
 * POST /api/ocr/process-optimized
 * 
 * Processes documents with cost optimization and caching
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler'
import { optimizedProcessor } from '@/lib/sam-gov/optimized-document-processor'
import { NotFoundError } from '@/lib/errors/types'
import { syncLogger } from '@/lib/errors/logger'

// Request validation schema
const processRequestSchema = z.object({
  opportunityId: z.string().uuid(),
  priority: z.number().min(1).max(10).default(5),
  batchSize: z.number().min(1).max(10).optional(),
  skipCache: z.boolean().default(false),
  maxRetries: z.number().min(1).max(5).default(3)
})

export const POST = routeHandler.POST(
  async ({ request, user, supabase }) => {
    const body = await request.json()
    const validatedData = processRequestSchema.parse(body)

    // Check if opportunity exists and belongs to user's saved opportunities
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        saved_opportunities!inner(id)
      `)
      .eq('id', validatedData.opportunityId)
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
        documentsProcessed: 0,
        totalCost: 0
      })
    }

    syncLogger.info('Starting optimized document processing', {
      opportunityId: validatedData.opportunityId,
      totalDocuments: resourceLinks.length,
      priority: validatedData.priority,
      skipCache: validatedData.skipCache
    })

    try {
      // Process documents with optimization
      const result = await optimizedProcessor.processOpportunity(
        validatedData.opportunityId,
        {
          priority: validatedData.priority,
          batchSize: validatedData.batchSize,
          skipCache: validatedData.skipCache,
          maxRetries: validatedData.maxRetries
        }
      )

      // Get processing statistics
      const stats = await optimizedProcessor.getProcessingStats(30)

      return NextResponse.json({
        success: true,
        message: `Successfully processed ${result.processedCount} documents (${result.cachedCount} from cache)`,
        documentsProcessed: result.processedCount,
        documentsCached: result.cachedCount,
        totalRequirements: result.results.reduce((sum, r) => sum + r.requirements.length, 0),
        totalCost: result.totalCost,
        savedCost: result.cachedCount * 0.01, // Estimated savings
        results: result.results.map(r => ({
          documentId: r.documentId,
          fileName: r.fileName,
          cached: r.cached,
          requirementsFound: r.requirements.length,
          processingTimeMs: r.processingTime,
          cost: r.cost
        })),
        statistics: {
          monthlyProcessed: stats.totalDocuments,
          monthlyCached: stats.cachedDocuments,
          monthlyCost: stats.totalCost,
          cacheHitRate: stats.cacheHitRate
        }
      })

    } catch (error) {
      syncLogger.error('Optimized document processing failed', error as Error, { 
        opportunityId: validatedData.opportunityId 
      })
      throw error
    }
  },
  { 
    requireAuth: true,
    rateLimit: 'ai' // Use AI rate limiting for OCR
  }
)

// GET endpoint to check processing status
export const GET = routeHandler.GET(
  async ({ request, supabase }) => {
    const { searchParams } = new URL(request.url)
    const opportunityId = searchParams.get('opportunityId')
    const days = parseInt(searchParams.get('days') || '30')

    if (opportunityId) {
      // Get processing status for specific opportunity
      const { data: documents, error } = await supabase
        .from('contract_documents')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const processed = documents?.filter(d => d.ocr_status === 'completed').length || 0
      const failed = documents?.filter(d => d.ocr_status === 'failed').length || 0
      const pending = documents?.filter(d => d.ocr_status === 'pending').length || 0
      const processing = documents?.filter(d => d.ocr_status === 'processing').length || 0

      return NextResponse.json({
        opportunityId,
        totalDocuments: documents?.length || 0,
        status: {
          processed,
          failed,
          pending,
          processing
        },
        documents: documents?.map(d => ({
          id: d.id,
          fileName: d.file_name,
          status: d.ocr_status,
          requirementsExtracted: d.extracted_requirements?.length || 0,
          error: d.processing_error,
          createdAt: d.created_at
        }))
      })
    } else {
      // Get general processing statistics
      const stats = await optimizedProcessor.getProcessingStats(days)
      
      return NextResponse.json({
        period: `last_${days}_days`,
        statistics: stats
      })
    }
  },
  { 
    requireAuth: true
  }
)