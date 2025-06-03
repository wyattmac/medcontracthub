/**
 * CSRF Token API Route
 * GET /api/csrf - Provides CSRF tokens for client-side requests
 */

import { NextResponse } from 'next/server'
import { routeHandler, IRouteContext } from '@/lib/api/route-handler'
import { generateAndSetCSRFToken } from '@/lib/security/csrf'

export const GET = routeHandler.GET(
  async ({ request }: IRouteContext) => {
    // Generate new CSRF token
    const { token, headers } = generateAndSetCSRFToken()
    
    const response = NextResponse.json({
      success: true,
      csrfToken: token,
      message: 'CSRF token generated successfully'
    })
    
    // Set headers for cookie and client access
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
  },
  {
    requireAuth: false, // CSRF tokens can be requested without auth
    rateLimit: 'api',
    csrf: { skipCSRF: true } // Skip CSRF for token generation endpoint
  }
)

export const HEAD = routeHandler.GET(
  async ({ request }: IRouteContext) => {
    // Generate token but only return headers
    const { headers } = generateAndSetCSRFToken()
    
    const response = new NextResponse(null, { status: 200 })
    
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
  },
  {
    requireAuth: false,
    rateLimit: 'api',
    csrf: { skipCSRF: true }
  }
)