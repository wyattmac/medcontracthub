// Based on Context7 research: Supabase middleware for Next.js authentication
// Reference: /supabase/supabase - nextjs ssr authentication setup

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/errors/logger'

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): void {
  // Content Security Policy - Strict policy for production security
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.sam.gov https://api.resend.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')
  
  // Apply security headers
  response.headers.set('Content-Security-Policy', cspDirectives)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // HSTS - Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  
  // Permissions Policy - Restrict dangerous features
  response.headers.set('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'fullscreen=(self)'
  ].join(', '))
}

const protectedRoutes = [
  '/dashboard',
  '/opportunities',
  '/saved',
  '/proposals',
  '/settings',
  '/onboarding'  // Onboarding requires auth but is handled separately
]

const authRoutes = [
  '/login',
  '/signup'
]

const publicRoutes = [
  '/',
  '/about',
  '/pricing',
  '/contact'
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const requestId = `mw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Log request
  logger.debug(`Middleware processing request`, {
    requestId,
    pathname,
    method: request.method
  })
  
  // Early return for static assets and API routes, but add security headers
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    const response = NextResponse.next()
    
    // Add security headers even to static assets
    if (!pathname.startsWith('/_next/static')) {
      addSecurityHeaders(response)
    }
    
    return response
  }

  let supabaseResponse = NextResponse.next({ request })

  try {
    // Check for required environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.error('Missing Supabase environment variables in middleware')
      // Allow public routes to proceed
      if (publicRoutes.some(route => pathname === route)) {
        const response = NextResponse.next()
        addSecurityHeaders(response)
        return response
      }
      // Redirect to error page for protected routes
      const errorResponse = NextResponse.redirect(new URL('/error?code=config', request.url))
      addSecurityHeaders(errorResponse)
      return errorResponse
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value }: any) => {
              request.cookies.set(name, value)
            })
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }: any) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // IMPORTANT: DO NOT REMOVE auth.getUser()
    // Add timeout to prevent hanging
    const authCheck = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null }, error: Error }>((_, reject) => 
        setTimeout(() => reject(new Error('Auth check timeout')), 5000)
      )
    ]).catch(error => {
      logger.error('Auth check failed', error, { requestId })
      return { data: { user: null }, error }
    })

    const { data: { user }, error } = authCheck

    if (error) {
      logger.warn('Auth error in middleware', { 
        error: error.message,
        requestId,
        pathname 
      })
    }

    // Check if route requires authentication
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
    const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

    // Protect dashboard routes
    if (isProtectedRoute && !user) {
      logger.info('Redirecting unauthenticated user to login', { 
        requestId,
        from: pathname 
      })
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('from', pathname)
      const redirectResponse = NextResponse.redirect(url)
      addSecurityHeaders(redirectResponse)
      return redirectResponse
    }

    // Check if user has completed onboarding
    if (user && isProtectedRoute && pathname !== '/onboarding') {
      // Fetch user profile to check onboarding status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profileError) {
        logger.error('Error fetching profile in middleware', profileError, { 
          requestId,
          userId: user.id 
        })
      }

      // If user doesn't have a company_id, they haven't completed onboarding
      if (!profile?.company_id) {
        logger.info('Redirecting user to complete onboarding', { 
          requestId,
          userId: user.id,
          from: pathname 
        })
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        url.searchParams.set('from', pathname)
        const redirectResponse = NextResponse.redirect(url)
        addSecurityHeaders(redirectResponse)
        return redirectResponse
      }
    }

    // Handle onboarding page access for users who already completed it
    if (user && pathname === '/onboarding') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      // If user already has a company, redirect to dashboard
      if (profile?.company_id) {
        logger.info('User already completed onboarding, redirecting to dashboard', { 
          requestId,
          userId: user.id 
        })
        const from = request.nextUrl.searchParams.get('from')
        const url = request.nextUrl.clone()
        url.pathname = from || '/dashboard'
        url.searchParams.delete('from')
        const redirectResponse = NextResponse.redirect(url)
        addSecurityHeaders(redirectResponse)
        return redirectResponse
      }
    }

    // Redirect authenticated users away from auth pages
    if (isAuthRoute && user) {
      logger.info('Redirecting authenticated user to dashboard', { 
        requestId,
        from: pathname 
      })
      const from = request.nextUrl.searchParams.get('from')
      const url = request.nextUrl.clone()
      url.pathname = from || '/dashboard'
      url.searchParams.delete('from')
      return NextResponse.redirect(url)
    }

    // Add request ID to response headers
    supabaseResponse.headers.set('x-request-id', requestId)
    
    // Add security headers to all responses
    addSecurityHeaders(supabaseResponse)
    
    return supabaseResponse
  } catch (error) {
    logger.error('Middleware error', error, { requestId, pathname })
    
    // For critical errors on protected routes, redirect to error page
    if (protectedRoutes.some(route => pathname.startsWith(route))) {
      const errorResponse = NextResponse.redirect(new URL('/error?code=middleware', request.url))
      addSecurityHeaders(errorResponse)
      return errorResponse
    }
    
    // Allow request to proceed for public routes
    const response = NextResponse.next()
    addSecurityHeaders(response)
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}