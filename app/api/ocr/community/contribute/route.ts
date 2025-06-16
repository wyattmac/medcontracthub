/**
 * Community OCR Contribution API
 * POST /api/ocr/community/contribute
 * 
 * Share an OCR extraction with the community
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler-next15'
import { apiLogger } from '@/lib/errors/logger'
import { trackUsage } from '@/lib/usage/tracker'

// Request validation schema
const contributeRequestSchema = z.object({
  documentId: z.string().uuid(),
  confirmAnonymized: z.boolean(),
  additionalNotes: z.string().optional()
})

export const POST = routeHandler.POST(
  async ({ request, user, supabase }) => {
    const body = await request.json()
    const { documentId, confirmAnonymized } = contributeRequestSchema.parse(body)

    if (!confirmAnonymized) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Must confirm data has been reviewed and anonymized' 
        },
        { status: 400 }
      )
    }

    try {
      // Verify document ownership
      const { data: document, error: docError } = await supabase
        .from('contract_documents')
        .select('*, company_id')
        .eq('id', documentId)
        .single()

      if (docError || !document) {
        return NextResponse.json(
          { success: false, error: 'Document not found' },
          { status: 404 }
        )
      }

      // Check ownership
      const hasAccess = document.user_id === user.id || 
        (document.company_id && await userBelongsToCompany(supabase, user.id, document.company_id))

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        )
      }

      // Check if already shared
      if (document.share_to_community) {
        return NextResponse.json({
          success: false,
          error: 'Document already shared with community'
        }, { status: 400 })
      }

      // Share extraction using database function
      const { data: extractionId, error: shareError } = await supabase.rpc(
        'share_extraction_to_community',
        {
          p_contract_document_id: documentId,
          p_user_id: user.id
        }
      )

      if (shareError) {
        apiLogger.error('Failed to share extraction', shareError)
        throw shareError
      }

      // Track contribution
      await trackUsage(user.id, 'ocr_document', -1, {
        action: 'shared_to_community',
        documentId,
        extractionId
      })

      // Get updated contribution stats
      const { data: profile } = await supabase
        .from('profiles')
        .select('community_contribution_score, total_extractions_shared')
        .eq('id', user.id)
        .single()

      apiLogger.info('Extraction shared with community', {
        userId: user.id,
        documentId,
        extractionId,
        newScore: profile?.community_contribution_score
      })

      return NextResponse.json({
        success: true,
        message: 'Thank you for contributing to the community!',
        extractionId,
        contributionScore: profile?.community_contribution_score || 0,
        totalShared: profile?.total_extractions_shared || 0,
        rewards: {
          pointsEarned: 10,
          bonusCredits: 5,
          message: 'You earned 10 contribution points and 5 bonus OCR credits!'
        }
      })

    } catch (error) {
      apiLogger.error('Failed to contribute extraction', error as Error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to share extraction with community' 
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

/**
 * Check if user belongs to a company
 */
async function userBelongsToCompany(
  supabase: any, 
  userId: string, 
  companyId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .eq('company_id', companyId)
    .single()
  
  return !!data
}