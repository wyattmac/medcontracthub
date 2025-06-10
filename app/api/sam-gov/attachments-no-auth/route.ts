/**
 * SAM.gov Attachments API - No Authentication Required
 * For development and testing purposes
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { samAttachmentProcessor } from '@/lib/sam-gov/attachment-processor'
import { logger } from '@/lib/errors/logger'

const getAttachmentsSchema = z.object({
  noticeId: z.string().min(1, 'Notice ID is required')
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const noticeId = searchParams.get('noticeId')
    
    // Validate input
    const validation = getAttachmentsSchema.safeParse({ noticeId })
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    logger.info('Getting SAM.gov attachment list (no auth)', { noticeId })

    try {
      const attachments = await samAttachmentProcessor.getOpportunityAttachments(noticeId!)
      
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
      logger.error('Error getting SAM.gov attachments', { noticeId, error })

      // If it's a "not found" error, return 404 instead of 500
      const errorMessage = error instanceof Error ? error.message : 'Failed to get attachments'
      const isNotFound = errorMessage.toLowerCase().includes('not found')
      
      return NextResponse.json({
        success: false,
        error: errorMessage,
        noticeId
      }, { status: isNotFound ? 404 : 500 })
    }
  } catch (error) {
    logger.error('Unexpected error in attachments API', { error })
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}