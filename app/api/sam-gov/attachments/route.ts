/**
 * SAM.gov Attachments API Endpoint
 * Processes opportunity attachments with OCR for proposal creation
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'
import { samAttachmentProcessor } from '@/lib/sam-gov/attachment-processor'
import { logger } from '@/lib/errors/logger'

const processAttachmentsSchema = z.object({
  noticeId: z.string().min(1, 'Notice ID is required'),
  maxAttachments: z.number().optional().default(5),
  includeRequirements: z.boolean().optional().default(true)
})

export const POST = enhancedRouteHandler.POST(
  async ({ user, sanitizedBody }) => {
    const { noticeId, maxAttachments, includeRequirements } = sanitizedBody

    logger.info('Processing SAM.gov attachments', {
      noticeId,
      maxAttachments,
      userId: user.id
    })

    try {
      if (includeRequirements) {
        // Complete processing with requirements extraction
        const result = await samAttachmentProcessor.processOpportunityForProposal(noticeId)
        
        return NextResponse.json({
          success: true,
          data: {
            noticeId,
            attachments: result.attachments,
            requirements: result.requirements,
            summary: result.summary,
            processedAt: new Date().toISOString()
          }
        })
      } else {
        // Just process attachments without requirements extraction
        const attachments = await samAttachmentProcessor.processOpportunityAttachments(
          noticeId,
          maxAttachments
        )
        
        return NextResponse.json({
          success: true,
          data: {
            noticeId,
            attachments,
            processedAt: new Date().toISOString()
          }
        })
      }
    } catch (error) {
      logger.error('Error processing SAM.gov attachments', {
        noticeId,
        userId: user.id,
        error
      })

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process attachments'
      }, { status: 500 })
    }
  },
  {
    requireAuth: true,
    validateBody: processAttachmentsSchema,
    rateLimit: 'ocr',
    sanitization: { body: 'strict' }
  }
)

const getAttachmentsSchema = z.object({
  noticeId: z.string().min(1, 'Notice ID is required')
})

export const GET = enhancedRouteHandler.GET(
  async ({ user, sanitizedQuery }) => {
    const { noticeId } = sanitizedQuery

    logger.info('Getting SAM.gov attachment list', {
      noticeId,
      userId: user.id
    })

    try {
      const attachments = await samAttachmentProcessor.getOpportunityAttachments(noticeId)
      
      return NextResponse.json({
        success: true,
        data: {
          noticeId,
          attachments: attachments.map(attachment => ({
            filename: attachment.filename,
            title: attachment.title,
            url: attachment.url
          })),
          count: attachments.length
        }
      })
    } catch (error) {
      logger.error('Error getting SAM.gov attachments', {
        noticeId,
        userId: user.id,
        error
      })

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get attachments'
      }, { status: 500 })
    }
  },
  {
    requireAuth: true,
    validateQuery: getAttachmentsSchema,
    rateLimit: 'api',
    sanitization: { query: 'strict' }
  }
)