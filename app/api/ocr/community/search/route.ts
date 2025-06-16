/**
 * Community OCR Search API
 * POST /api/ocr/community/search
 * 
 * Search for similar documents in the community extraction database
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler-next15'
import { apiLogger } from '@/lib/errors/logger'

// Request validation schema
const searchRequestSchema = z.object({
  textSample: z.string().min(50).max(5000),
  documentType: z.string().optional(),
  similarityThreshold: z.number().min(0).max(1).default(0.8),
  limit: z.number().min(1).max(50).default(10)
})

// Response type
interface CommunityExtraction {
  extractionId: string
  similarityScore: number
  confidenceScore: number
  usageCount: number
  extractedText: string
  structuredData: any
  requirements: any[]
}

export const POST = routeHandler.POST(
  async ({ request, user, supabase }) => {
    const body = await request.json()
    const { 
      textSample, 
      documentType, 
      similarityThreshold, 
      limit 
    } = searchRequestSchema.parse(body)

    try {
      // Call the database function to find similar extractions
      const { data: extractions, error } = await supabase.rpc(
        'find_similar_extractions',
        {
          p_text_sample: textSample,
          p_document_type: documentType,
          p_threshold: similarityThreshold
        }
      )

      if (error) {
        apiLogger.error('Community search failed', error)
        throw error
      }

      // Fetch full extraction data for the matches
      const extractionIds = extractions?.map((e: any) => e.extraction_id) || []
      
      if (extractionIds.length === 0) {
        return NextResponse.json({
          success: true,
          extractions: [],
          message: 'No similar documents found'
        })
      }

      // Get full extraction details
      const { data: fullExtractions, error: fetchError } = await supabase
        .from('community_extractions')
        .select('*')
        .in('id', extractionIds)
        .eq('status', 'active')
        .limit(limit)

      if (fetchError) {
        apiLogger.error('Failed to fetch extraction details', fetchError)
        throw fetchError
      }

      // Combine with similarity scores
      const results: CommunityExtraction[] = fullExtractions.map(extraction => {
        const match = extractions.find((e: any) => e.extraction_id === extraction.id)
        return {
          extractionId: extraction.id,
          similarityScore: match?.similarity_score || 0,
          confidenceScore: extraction.confidence_score,
          usageCount: extraction.usage_count,
          extractedText: extraction.extracted_text,
          structuredData: extraction.structured_data,
          requirements: extraction.extracted_requirements || []
        }
      })

      // Sort by similarity score
      results.sort((a, b) => b.similarityScore - a.similarityScore)

      // Log search metrics
      apiLogger.info('Community search completed', {
        userId: user.id,
        resultsFound: results.length,
        topSimilarity: results[0]?.similarityScore || 0
      })

      return NextResponse.json({
        success: true,
        extractions: results,
        totalFound: results.length,
        searchParams: {
          similarityThreshold,
          documentType
        }
      })

    } catch (error) {
      apiLogger.error('Community search error', error as Error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to search community extractions' 
        },
        { status: 500 }
      )
    }
  },
  { 
    requireAuth: true,
    rateLimit: 'api'
  }
)