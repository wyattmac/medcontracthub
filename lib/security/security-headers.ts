import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Content Security Policy configuration
 */
function generateCSP(): string {
  const directives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-eval'", // Required for Next.js in dev
      "'unsafe-inline'", // Required for Next.js
      'https://challenges.cloudflare.com',
      'https://js.stripe.com', // Stripe payment scripts
      'https://js.stripe.com/basil/', // Stripe basil scripts
      process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''
    ].filter(Boolean),
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind
      'https://fonts.googleapis.com'
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com'
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://*.supabase.co',
      'https://*.supabase.in'
    ],
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'https://*.supabase.in',
      'https://api.anthropic.com',
      'https://api.sam.gov',
      'https://api.resend.com',
      'https://api.stripe.com', // Stripe API
      'https://*.stripe.com', // Stripe CDN and API subdomains
      'wss://*.supabase.co',
      'wss://*.supabase.in'
    ],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'frame-src': ["'self'", 'https://js.stripe.com', 'https://*.stripe.com'],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:']
  }

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ')
}

/**
 * Security headers configuration
 */
export const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': generateCSP()
}

/**
 * Applies security headers to a response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}

/**
 * CORS configuration for API routes
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
}

/**
 * Rate limiting configuration per endpoint
 */
export const rateLimitConfig = {
  // Authentication endpoints - strict limits
  '/api/auth/login': { requests: 5, window: '15m' },
  '/api/auth/signup': { requests: 3, window: '1h' },
  '/api/auth/reset-password': { requests: 3, window: '1h' },
  
  // AI endpoints - expensive operations
  '/api/ai/analyze': { requests: 10, window: '1h' },
  '/api/ai/recommendations': { requests: 20, window: '1h' },
  
  // Data endpoints - moderate limits
  '/api/opportunities/search': { requests: 60, window: '1m' },
  '/api/opportunities/save': { requests: 30, window: '1m' },
  '/api/proposals': { requests: 30, window: '1m' },
  
  // Export endpoints - resource intensive
  '/api/export': { requests: 10, window: '1h' },
  
  // Monitoring endpoints - frequent but lightweight
  '/api/monitoring/journey': { requests: 30, window: '1m' },
  '/api/health': { requests: 120, window: '1m' },
  
  // Default for other endpoints
  default: { requests: 100, window: '1m' }
}

/**
 * Security middleware for API routes
 */
export function createSecurityMiddleware() {
  return async (req: NextRequest) => {
    const response = NextResponse.next()
    
    // Apply security headers
    applySecurityHeaders(response)
    
    // Apply CORS headers for API routes
    if (req.nextUrl.pathname.startsWith('/api/')) {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
    }
    
    return response
  }
}