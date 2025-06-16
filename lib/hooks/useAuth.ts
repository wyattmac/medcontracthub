/**
 * Universal Auth Hook
 * Works with both mock auth (development) and real Supabase auth (production)
 */

'use client'

import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { useMockAuth } from '@/components/auth/mock-auth-provider'
import { createBrowserClient } from '@supabase/ssr'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const isDevelopment = process.env.NODE_ENV === 'development' && 
                        process.env.NEXT_PUBLIC_DEVELOPMENT_AUTH_BYPASS === 'true'
  
  // Use mock auth in development
  const mockAuth = isDevelopment ? useMockAuth() : null
  
  // State for production auth
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: !isDevelopment,
    error: null
  })

  useEffect(() => {
    if (isDevelopment) {
      // In development, use mock auth
      return
    }

    // In production, use Supabase auth
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setAuthState({ user: null, loading: false, error: error.message })
      } else {
        setAuthState({ user: session?.user || null, loading: false, error: null })
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({ user: session?.user || null, loading: false, error: null })
    })

    return () => subscription.unsubscribe()
  }, [isDevelopment])

  // Return appropriate auth state
  if (isDevelopment && mockAuth) {
    return {
      user: mockAuth.user,
      loading: mockAuth.loading,
      error: null,
      isDevelopment: true
    }
  }

  return {
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    isDevelopment: false
  }
}