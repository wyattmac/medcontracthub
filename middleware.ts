// Based on Context7 research: Supabase middleware for Next.js authentication
// Reference: /supabase/supabase - nextjs ssr authentication setup

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  console.log('[Middleware] Processing request:', request.nextUrl.pathname)
  
  // Early return for static assets and API routes
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.includes('.')
  ) {
    console.log('[Middleware] Skipping static/API route')
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value, options }: any) => {
              console.log('[Middleware] Setting cookie:', name)
              request.cookies.set(name, value)
            })
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }: any) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // IMPORTANT: DO NOT REMOVE auth.getUser()
    console.log('[Middleware] Checking user authentication...')
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    if (error) {
      console.error('[Middleware] Auth error:', error.message)
    }

    console.log('[Middleware] User authenticated:', !!user)

    // Protect dashboard routes
    if (
      (request.nextUrl.pathname.startsWith('/dashboard') ||
       request.nextUrl.pathname.startsWith('/opportunities') ||
       request.nextUrl.pathname.startsWith('/saved') ||
       request.nextUrl.pathname.startsWith('/proposals') ||
       request.nextUrl.pathname.startsWith('/settings')) &&
      !user
    ) {
      console.log('[Middleware] Redirecting unauthenticated user to login')
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from auth pages
    if (
      (request.nextUrl.pathname.startsWith('/login') ||
       request.nextUrl.pathname.startsWith('/signup')) &&
      user
    ) {
      console.log('[Middleware] Redirecting authenticated user to dashboard')
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    console.log('[Middleware] Request allowed to proceed')
    return supabaseResponse
  } catch (error) {
    console.error('[Middleware] Unexpected error:', error)
    // Allow request to proceed on error to prevent blocking the site
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