import { NextResponse } from 'next/server'
import { getSAMApiClient } from '@/lib/sam-gov/client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const noticeId = searchParams.get('noticeId')
  
  if (!noticeId) {
    return NextResponse.json({ error: 'Notice ID required' }, { status: 400 })
  }

  try {
    const samClient = getSAMApiClient()
    const response = await samClient.getOpportunityById(noticeId)
    
    return NextResponse.json({
      success: true,
      noticeId,
      hasData: !!response.opportunitiesData,
      dataCount: response.opportunitiesData?.length || 0,
      opportunity: response.opportunitiesData?.[0] || null,
      resourceLinks: response.opportunitiesData?.[0]?.resourceLinks || []
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      noticeId
    }, { status: 500 })
  }
}