/**
 * Safe Auth Provider
 * Wraps the main auth provider with error boundaries and fallbacks
 */

'use client'

import React, { createContext, useContext, useState } from 'react'
import { AuthProvider, useAuth as useRealAuth } from '@/lib/hooks/useAuth'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Company = Database['public']['Tables']['companies']['Row']

interface ISafeAuthContext {
  user: User | null
  profile: Profile | null
  company: Company | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
  refreshProfile: (userId?: string, signal?: AbortSignal) => Promise<void>
}

const SafeAuthContext = createContext<ISafeAuthContext | undefined>(undefined)

class AuthErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error: string | null }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    console.error('[AuthErrorBoundary] Caught auth error:', error)
    return { 
      hasError: true, 
      error: error.message.includes('Auth session missing') 
        ? 'Please log in to continue' 
        : error.message 
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AuthErrorBoundary] Auth error details:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

function SafeAuthWrapper({ children }: { children: React.ReactNode }) {
  const [authError, setAuthError] = useState<string | null>(null)

  try {
    const auth = useRealAuth()
    
    const safeAuth: ISafeAuthContext = {
      ...auth,
      error: authError
    }

    return (
      <SafeAuthContext.Provider value={safeAuth}>
        {children}
      </SafeAuthContext.Provider>
    )
  } catch (error: any) {
    console.error('[SafeAuthWrapper] Auth hook error:', error)
    
    // Provide fallback auth state when auth fails
    const fallbackAuth: ISafeAuthContext = {
      user: null,
      profile: null,
      company: null,
      loading: false,
      error: error.message.includes('Auth session missing') 
        ? 'Please log in to continue' 
        : error.message,
      signOut: async () => {},
      refreshProfile: async () => {}
    }

    return (
      <SafeAuthContext.Provider value={fallbackAuth}>
        {children}
      </SafeAuthContext.Provider>
    )
  }
}

export function SafeAuthProvider({ children }: { children: React.ReactNode }) {
  const fallback = (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Authentication Error</h3>
        <p className="text-muted-foreground mb-4">
          There was an issue with authentication. Please refresh the page.
        </p>
        <button 
          onClick={() => window.location.href = '/login'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Login
        </button>
      </div>
    </div>
  )

  return (
    <AuthErrorBoundary fallback={fallback}>
      <AuthProvider>
        <SafeAuthWrapper>
          {children}
        </SafeAuthWrapper>
      </AuthProvider>
    </AuthErrorBoundary>
  )
}

export function useSafeAuth() {
  const context = useContext(SafeAuthContext)
  if (context === undefined) {
    throw new Error('useSafeAuth must be used within a SafeAuthProvider')
  }
  return context
}