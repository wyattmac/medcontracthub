// Based on Context7 research: Supabase middleware for Next.js authentication
// Reference: /supabase/supabase - nextjs ssr authentication setup

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/errors/logger'

const protectedRoutes = [
  '/dashboard',
  '/opportunities',
  '/saved',
  '/proposals',
  '/settings'
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
  
  // Early return for static assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  try {
    // Check for required environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.error('Missing Supabase environment variables in middleware')
      // Allow public routes to proceed
      if (publicRoutes.some(route => pathname === route)) {
        return NextResponse.next()
      }
      // Redirect to error page for protected routes
      return NextResponse.redirect(new URL('/error?code=config', request.url))
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
      return NextResponse.redirect(url)
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
    
    return supabaseResponse
  } catch (error) {
    logger.error('Middleware error', error, { requestId, pathname })
    
    // For critical errors on protected routes, redirect to error page
    if (protectedRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/error?code=middleware', request.url))
    }
    
    // Allow request to proceed for public routes
    return NextResponse.next()
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