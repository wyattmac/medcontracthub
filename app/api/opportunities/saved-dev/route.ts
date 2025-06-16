/**
 * Development API Route: Get saved opportunities from localStorage
 * GET /api/opportunities/saved-dev
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // This endpoint is called server-side, so we can't access localStorage directly
  // Instead, we'll return an empty array and let the client-side handle localStorage
  
  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const sortBy = searchParams.get('sort_by') || 'deadline'
  
  // Return empty data structure for the client to populate
  return NextResponse.json({
    opportunities: [],
    totalCount: 0,
    pagination: {
      offset: 0,
      limit: 25,
      total: 0,
      hasMore: false
    }
  })
}