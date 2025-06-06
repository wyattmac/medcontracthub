/**
 * CSRF Protection Utilities
 * Prevents Cross-Site Request Forgery attacks on state-changing operations
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const CSRF_TOKEN_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

// CSRF secret must be provided via environment variable
const CSRF_SECRET = process.env.CSRF_SECRET
if (!CSRF_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('CSRF_SECRET environment variable is required in production')
}

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  if (!CSRF_SECRET) {
    throw new Error('CSRF_SECRET environment variable is required')
  }
  
  const timestamp = Date.now().toString()
  const randomBytes = crypto.randomBytes(32).toString('hex')
  const payload = `${timestamp}:${randomBytes}`
  
  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', CSRF_SECRET)
  hmac.update(payload)
  const signature = hmac.digest('hex')
  
  // Combine payload and signature
  const token = `${payload}:${signature}`
  return Buffer.from(token).toString('base64')
}

/**
 * Verify CSRF token validity
 */
export function verifyCSRFToken(token: string): boolean {
  if (!CSRF_SECRET) {
    throw new Error('CSRF_SECRET environment variable is required')
  }
  
  try {
    // Decode token
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const parts = decoded.split(':')
    
    if (parts.length !== 3) {
      return false
    }
    
    const [timestamp, randomBytes, signature] = parts
    const payload = `${timestamp}:${randomBytes}`
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', CSRF_SECRET)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')
    
    if (signature !== expectedSignature) {
      return false
    }
    
    // Check token age (max 24 hours)
    const tokenTime = parseInt(timestamp)
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    
    if (now - tokenTime > maxAge) {
      return false
    }
    
    return true
  } catch (error) {
    console.error('CSRF token verification error:', error)
    return false
  }
}

/**
 * Set CSRF token in cookies
 */
export async function setCSRFTokenCookie(token: string) {
  const cookieStore = await cookies()
  
  cookieStore.set(CSRF_TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/'
  })
}

/**
 * Get CSRF token from cookies
 */
export async function getCSRFTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(CSRF_TOKEN_NAME)
    return token?.value || null
  } catch (error) {
    // cookies() might not be available in all contexts
    return null
  }
}

/**
 * Get CSRF token from request headers
 */
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME) || 
         request.headers.get('x-xsrf-token') || // Alternative header name
         null
}

/**
 * Verify CSRF token from request
 */
export function verifyCSRFFromRequest(request: NextRequest): boolean {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true
  }
  
  // Skip CSRF for API routes that explicitly opt out
  const url = new URL(request.url)
  if (url.pathname.includes('/api/health') || url.pathname.includes('/api/status')) {
    return true
  }
  
  const tokenFromHeader = getCSRFTokenFromRequest(request)
  const cookieToken = request.cookies.get(CSRF_TOKEN_NAME)?.value
  
  // Both header token and cookie token must be present
  if (!tokenFromHeader || !cookieToken) {
    return false
  }
  
  // Tokens must match
  if (tokenFromHeader !== cookieToken) {
    return false
  }
  
  // Token must be valid
  return verifyCSRFToken(tokenFromHeader)
}

/**
 * Middleware function to check CSRF protection
 */
export async function csrfProtection(request: NextRequest): Promise<{
  success: boolean
  error?: string
  headers?: HeadersInit
}> {
  const isValid = verifyCSRFFromRequest(request)
  
  if (!isValid) {
    return {
      success: false,
      error: 'CSRF token validation failed',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  }
  
  return { success: true }
}

/**
 * Generate and set new CSRF token for client
 */
export function generateAndSetCSRFToken(): { token: string; headers: HeadersInit } {
  const token = generateCSRFToken()
  
  const headers = new Headers()
  headers.set('Set-Cookie', `${CSRF_TOKEN_NAME}=${token}; HttpOnly; Secure=${process.env.NODE_ENV === 'production'}; SameSite=Strict; Max-Age=${24 * 60 * 60}; Path=/`)
  headers.set('X-CSRF-Token', token) // Send token in response header for client to use
  
  return {
    token,
    headers: Object.fromEntries(headers.entries())
  }
}

/**
 * CSRF protection for form submissions
 */
export function generateCSRFFormField(token?: string): string {
  const csrfToken = token || generateCSRFToken()
  return `<input type="hidden" name="_csrf" value="${csrfToken}" />`
}

/**
 * Extract CSRF token from form data
 */
export function getCSRFTokenFromFormData(formData: FormData): string | null {
  return formData.get('_csrf') as string || null
}

/**
 * React hook for CSRF protection (client-side)
 */
export function useCSRFToken() {
  // This will be implemented on the client side
  return {
    getToken: () => {
      if (typeof document !== 'undefined') {
        // Get token from meta tag or cookie
        const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        if (metaToken) return metaToken
        
        // Fallback to cookie parsing (less secure)
        const cookies = document.cookie.split(';')
        const csrfCookie = cookies.find(cookie => cookie.trim().startsWith(`${CSRF_TOKEN_NAME}=`))
        return csrfCookie ? csrfCookie.split('=')[1] : null
      }
      return null
    },
    
    getHeaders: () => {
      const token = this.getToken()
      return token ? { [CSRF_HEADER_NAME]: token } : {}
    }
  }
}

/**
 * Express-style CSRF middleware for API routes
 */
export function withCSRFProtection<T extends (...args: any[]) => any>(
  handler: T,
  options: { skipCSRF?: boolean } = {}
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    if (options.skipCSRF) {
      return handler(request, ...args)
    }
    
    const csrfResult = await csrfProtection(request)
    
    if (!csrfResult.success) {
      return new Response(
        JSON.stringify({
          error: 'CSRF protection failed',
          message: 'Invalid or missing CSRF token. Please refresh the page and try again.'
        }),
        {
          status: 403,
          headers: csrfResult.headers
        }
      )
    }
    
    return handler(request, ...args)
  }) as T
}