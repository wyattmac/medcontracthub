import { NextResponse } from 'next/server'
import { getSAMApiClient } from '@/lib/sam-gov/client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const noticeId = searchParams.get('noticeId')
  
  if (!noticeId) {
    return NextResponse.json({ error: 'noticeId required' }, { status: 400 })
  }
  
  try {
    const client = getSAMApiClient()
    
    // Try to get the opportunity
    const response = await client.getOpportunityById(noticeId)
    
    return NextResponse.json({
      success: true,
      noticeId,
      found: response.opportunitiesData?.length > 0,
      opportunity: response.opportunitiesData?.[0] || null,
      resourceLinks: response.opportunitiesData?.[0]?.resourceLinks || []
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      noticeId,
      error: error instanceof Error ? error.message : 'Unknown error',
      apiKey: process.env.SAM_GOV_API_KEY ? 'configured' : 'missing'
    })
  }
}