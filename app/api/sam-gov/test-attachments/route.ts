/**
 * Test Attachments API - Returns mock data to verify route is working
 */

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const noticeId = searchParams.get('noticeId')
    
    console.log('[Test Attachments API] Called with noticeId:', noticeId)
    
    // Return mock data
    const mockAttachments = noticeId ? [
      {
        filename: 'RFP_Document.pdf',
        title: 'Request for Proposal',
        url: 'https://sam.gov/mockfile1.pdf'
      },
      {
        filename: 'Technical_Requirements.pdf',
        title: 'Technical Requirements Document',
        url: 'https://sam.gov/mockfile2.pdf'
      }
    ] : []
    
    return NextResponse.json({
      success: true,
      data: {
        noticeId,
        attachments: mockAttachments,
        count: mockAttachments.length
      }
    })
  } catch (error) {
    console.error('[Test Attachments API] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}