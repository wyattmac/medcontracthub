/**
 * Public SAM.gov Attachments API Endpoint
 * For fetching attachments without authentication (e.g., for compliance matrix)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/errors/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const opportunityId = searchParams.get('opportunityId')
    
    if (!opportunityId) {
      return NextResponse.json({
        success: false,
        error: 'Opportunity ID is required'
      }, { status: 400 })
    }

    // Get opportunity details from database
    const supabase = await createClient()
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .select('id, notice_id, title, attachments, additional_info, sam_url')
      .eq('id', opportunityId)
      .single()

    if (error || !opportunity) {
      logger.error('Failed to fetch opportunity', { opportunityId, error })
      return NextResponse.json({
        success: false,
        error: 'Opportunity not found'
      }, { status: 404 })
    }

    // Extract attachments from opportunity data
    let attachments = []
    
    // Check for attachments in the attachments field (primary source)
    if (opportunity.attachments && Array.isArray(opportunity.attachments)) {
      attachments = opportunity.attachments.map((att: any, index: number) => {
        // Ensure each attachment has proper structure
        const attachment = {
          id: att.id || `attachment-${opportunityId}-${index}`,
          name: att.name || att.filename || att.title || `Attachment ${index + 1}`,
          url: att.url || att.link || '',
          size: att.size || att.fileSize || 0,
          type: att.type || att.mimeType || att.contentType || 'application/pdf',
          description: att.description || '',
          uploadedDate: att.uploadedDate || att.created_at || new Date().toISOString()
        }
        
        // If URL is relative, make it absolute using SAM.gov base URL
        if (attachment.url && !attachment.url.startsWith('http')) {
          attachment.url = `https://sam.gov${attachment.url}`
        }
        
        return attachment
      })
    }
    
    // Also check additional_info for resource links (secondary source)
    if (opportunity.additional_info?.resourceLinks) {
      const resourceLinks = opportunity.additional_info.resourceLinks
      if (Array.isArray(resourceLinks)) {
        resourceLinks.forEach((link: any, index: number) => {
          // Don't duplicate if already in attachments
          const isDuplicate = attachments.some(att => 
            att.url === link.url || att.url === link.link
          )
          
          if (!isDuplicate) {
            attachments.push({
              id: `resource-${opportunityId}-${index}`,
              name: link.name || link.title || `Resource ${index + 1}`,
              url: link.url || link.link || '',
              size: link.size || 0,
              type: link.type || 'application/pdf',
              description: link.description || '',
              uploadedDate: link.uploadedDate || new Date().toISOString()
            })
          }
        })
      }
    }

    // For development/testing, add mock attachments if none found
    if (attachments.length === 0 && process.env.NODE_ENV === 'development') {
      // Create opportunity-specific mock attachments
      const opportunityTitle = opportunity.title || 'Medical Equipment'
      const noticeId = opportunity.notice_id || 'DEV-NOTICE-123'
      
      attachments = [
        {
          id: `mock-${opportunityId}-1`,
          name: `RFP-${noticeId}-Section-L-M.pdf`,
          url: `/mock-attachments/${opportunityId}/rfp-section-l-m.pdf`,
          size: 1024000,
          type: 'application/pdf',
          description: `Section L & M requirements for ${opportunityTitle}`,
          uploadedDate: new Date().toISOString()
        },
        {
          id: `mock-${opportunityId}-2`,
          name: `SOW-${noticeId}.pdf`,
          url: `/mock-attachments/${opportunityId}/statement-of-work.pdf`,
          size: 512000,
          type: 'application/pdf',
          description: `Statement of Work for ${opportunityTitle}`,
          uploadedDate: new Date().toISOString()
        },
        {
          id: `mock-${opportunityId}-3`,
          name: `Technical-Requirements-${noticeId}.pdf`,
          url: `/mock-attachments/${opportunityId}/technical-requirements.pdf`,
          size: 768000,
          type: 'application/pdf',
          description: `Technical specifications for ${opportunityTitle}`,
          uploadedDate: new Date().toISOString()
        }
      ]
    }
    
    return NextResponse.json({
      success: true,
      attachments,
      count: attachments.length,
      opportunityId,
      noticeId: opportunity.notice_id
    })
  } catch (error) {
    logger.error('Error fetching attachments', { error })
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch attachments'
    }, { status: 500 })
  }
}