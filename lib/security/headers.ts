import { NextResponse } from 'next/server'

/**
 * Security headers configuration
 * Implements defense-in-depth security headers
 */
export const securityHeaders = {
  // Enforces HTTPS connections
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Prevents clickjacking attacks
  'X-Frame-Options': 'DENY',
  
  // Prevents MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enables XSS filtering in older browsers
  'X-XSS-Protection': '1; mode=block',
  
  // Controls referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Disables browser features
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  
  // DNS prefetch control
  'X-DNS-Prefetch-Control': 'on',
  
  // Download options
  'X-Download-Options': 'noopen',
  
  // Permitted cross-domain policies
  'X-Permitted-Cross-Domain-Policies': 'none',
}

/**
 * Content Security Policy configuration
 * Restricts resource loading to prevent XSS and data injection
 */
export function generateCSP(): string {
  const isDev = process.env.NODE_ENV === 'development'
  
  const directives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-eval'", // Required for Next.js in dev
      "'unsafe-inline'", // Required for Next.js
      'https://va.vercel-scripts.com', // Vercel Analytics
      isDev && 'http://localhost:3000',
    ].filter(Boolean),
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind/styled-jsx
      'https://fonts.googleapis.com',
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://*.supabase.co', // Supabase storage
      'https://www.gravatar.com', // Avatar images
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
    ],
    'connect-src': [
      "'self'",
      'https://*.supabase.co', // Supabase APIs
      'https://api.sam.gov', // SAM.gov API
      'https://api.anthropic.com', // Claude API
      'https://api.resend.com', // Email service
      'https://api.mistral.ai', // OCR service
      'wss://*.supabase.co', // Supabase realtime
      isDev && 'ws://localhost:3000', // HMR in dev
      isDev && 'http://localhost:3000',
    ].filter(Boolean),
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'child-src': ["'none'"],
    'frame-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'manifest-src': ["'self'"],
    'upgrade-insecure-requests': !isDev ? [''] : undefined,
  }
  
  return Object.entries(directives)
    .filter(([_, values]) => values !== undefined)
    .map(([key, values]) => {
      const valueString = Array.isArray(values) ? values.join(' ') : values
      return `${key} ${valueString}`
    })
    .join('; ')
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // Apply all security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  // Apply CSP
  response.headers.set('Content-Security-Policy', generateCSP())
  
  return response
}