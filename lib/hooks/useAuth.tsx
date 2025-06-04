'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { setUserContext, clearUserContext } from '@/lib/monitoring/sentry'

type Profile = Database['public']['Tables']['profiles']['Row']
type Company = Database['public']['Tables']['companies']['Row']

interface IAuthContext {
  user: User | null
  profile: Profile | null
  company: Company | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: (userId?: string, signal?: AbortSignal) => Promise<void>
}

const AuthContext = createContext<IAuthContext | undefined>(undefined)

interface IAuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: IAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const mountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  const refreshProfile = useCallback(async (userId?: string, signal?: AbortSignal) => {
    console.log('[useAuth] Refreshing profile...', { userId, currentUserId: user?.id })
    
    const targetUserId = userId || user?.id
    
    if (!targetUserId) {
      console.log('[useAuth] No user ID, skipping profile refresh')
      return
    }

    try {
      // Check if aborted before making requests
      if (signal?.aborted) {
        console.log('[useAuth] Profile refresh aborted before start')
        return
      }

      console.log('[useAuth] Fetching profile for user:', targetUserId)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId as any)
        .single()

      // Check if aborted after profile fetch
      if (signal?.aborted) {
        console.log('[useAuth] Profile refresh aborted after profile fetch')
        return
      }

      if (profileError || !profileData) {
        console.error('[useAuth] Profile fetch error:', profileError)
        return
      }

      console.log('[useAuth] Profile loaded:', (profileData as any).id)
      
      // Only update state if still mounted and not aborted
      if (mountedRef.current && !signal?.aborted) {
        setProfile(profileData as any) // Type assertion for database schema compatibility
      }

      if ((profileData as any).company_id) {
        console.log('[useAuth] Fetching company:', (profileData as any).company_id)
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', (profileData as any).company_id)
          .single()

        // Check if aborted after company fetch
        if (signal?.aborted) {
          console.log('[useAuth] Profile refresh aborted after company fetch')
          return
        }

        if (companyError || !companyData) {
          console.error('[useAuth] Company fetch error:', companyError)
          return
        }

        console.log('[useAuth] Company loaded:', (companyData as any).name)
        
        // Only update state if still mounted and not aborted
        if (mountedRef.current && !signal?.aborted) {
          setCompany(companyData as any) // Type assertion for database schema compatibility
        }
      }
      
      console.log('[useAuth] Profile refresh complete')
    } catch (error: any) {
      // Don't log abort errors
      if (error?.name !== 'AbortError') {
        console.error('[useAuth] Unexpected error in refreshProfile:', error)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase])

  useEffect(() => {
    // Create new AbortController for this effect
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const getUser = async () => {
      console.log('[useAuth] Starting initial user load...')
      
      try {
        // Check if aborted before starting
        if (abortController.signal.aborted) {
          console.log('[useAuth] Initial load aborted before start')
          return
        }

        console.log('[useAuth] Calling supabase.auth.getUser()')
        const { data: { user }, error } = await supabase.auth.getUser()
        
        // Check if aborted after getting user
        if (abortController.signal.aborted) {
          console.log('[useAuth] Initial load aborted after getUser')
          return
        }

        console.log('[useAuth] getUser result:', { user: user?.email, error })
        
        if (error) {
          console.error('[useAuth] Initial auth error:', error)
          if (!abortController.signal.aborted) {
            setLoading(false)
          }
          return
        }
        
        if (user) {
          console.log('[useAuth] User found:', user.email)
          if (!abortController.signal.aborted) {
            setUser(user)
            // Set user context in Sentry
            setUserContext({
              id: user.id,
              email: user.email || undefined
            })
          }
          // Load profile data immediately with the user ID
          console.log('[useAuth] Loading profile data...')
          await refreshProfile(user.id, abortController.signal)
          console.log('[useAuth] Profile load complete')
        } else {
          console.log('[useAuth] No user found')
          if (!abortController.signal.aborted) {
            setLoading(false)
          }
        }
      } catch (error: any) {
        // Don't log abort errors
        if (error?.name !== 'AbortError') {
          console.error('[useAuth] Unexpected error getting user:', error)
        }
      } finally {
        if (!abortController.signal.aborted) {
          console.log('[useAuth] Setting loading to false')
          setLoading(false)
        }
      }
    }

    console.log('[useAuth] useEffect triggered, calling getUser')
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        // Check if component is still mounted and not aborted
        if (!mountedRef.current || abortController.signal.aborted) return
        
        console.log('[useAuth] Auth state changed:', event)
        
        if (session?.user) {
          console.log('[useAuth] Session user:', session.user.email)
          setUser(session.user)
          // refreshProfile will be called automatically due to user state change
        } else {
          console.log('[useAuth] No session, clearing user data')
          setUser(null)
          setProfile(null)
          setCompany(null)
          // Clear user context from Sentry
          clearUserContext()
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('[useAuth] User signed out, redirecting to login')
          router.push('/login')
        }
      }
    )

    return () => {
      console.log('[useAuth] Cleaning up auth subscription')
      // Abort any in-flight requests
      abortController.abort()
      abortControllerRef.current = null
      subscription.unsubscribe()
      // Only set mountedRef to false on actual unmount
      mountedRef.current = false
    }
  }, [supabase, router, refreshProfile])

  // Separate effect to handle profile refresh when user changes
  useEffect(() => {
    if (user && mountedRef.current) {
      // Use the abort controller from the main effect if available
      const signal = abortControllerRef.current?.signal
      refreshProfile(undefined, signal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, refreshProfile])

  const signOut = async () => {
    console.log('[useAuth] Signing out...')
    try {
      await supabase.auth.signOut()
      // Clear user context from Sentry
      clearUserContext()
      console.log('[useAuth] Sign out successful')
    } catch (error) {
      console.error('[useAuth] Sign out error:', error)
    }
  }

  const value = {
    user,
    profile,
    company,
    loading,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}