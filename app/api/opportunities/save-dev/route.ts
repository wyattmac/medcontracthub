/**
 * Development Save Endpoint - No CSRF Required
 * For testing in development mode only
 */

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { opportunityId, action } = body

    if (!opportunityId || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 })
    }
    
    // For development, just return success
    // The actual saving is handled client-side in localStorage

    if (action === 'save') {
      return NextResponse.json({ 
        success: true,
        message: 'Opportunity saved successfully'
      })
    } else {
      // action === 'unsave'
      return NextResponse.json({
        success: true,
        message: 'Opportunity unsaved successfully'
      })
    }
  } catch (error) {
    console.error('Save endpoint error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}