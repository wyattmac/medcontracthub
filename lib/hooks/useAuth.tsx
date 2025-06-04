'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Company = Database['public']['Tables']['companies']['Row']

interface IAuthContext {
  user: User | null
  profile: Profile | null
  company: Company | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: (userId?: string) => Promise<void>
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

  // Remove this effect - we'll handle cleanup in the main effect

  const refreshProfile = useCallback(async (userId?: string) => {
    console.log('[useAuth] Refreshing profile...', { userId, currentUserId: user?.id })
    
    const targetUserId = userId || user?.id
    
    if (!targetUserId) {
      console.log('[useAuth] No user ID, skipping profile refresh')
      return
    }

    try {
      console.log('[useAuth] Fetching profile for user:', targetUserId)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId as any)
        .single()

      // Don't check mounted status here - let the profile load complete

      if (profileError || !profileData) {
        console.error('[useAuth] Profile fetch error:', profileError)
        return
      }

      console.log('[useAuth] Profile loaded:', (profileData as any).id)
      
      // Only update state if still mounted
      if (mountedRef.current) {
        setProfile(profileData as any) // Type assertion for database schema compatibility
      }

      if ((profileData as any).company_id) {
        console.log('[useAuth] Fetching company:', (profileData as any).company_id)
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', (profileData as any).company_id)
          .single()

        // Don't check mounted status here - let the company load complete

        if (companyError || !companyData) {
          console.error('[useAuth] Company fetch error:', companyError)
          return
        }

        console.log('[useAuth] Company loaded:', (companyData as any).name)
        
        // Only update state if still mounted
        if (mountedRef.current) {
          setCompany(companyData as any) // Type assertion for database schema compatibility
        }
      }
      
      console.log('[useAuth] Profile refresh complete')
    } catch (error) {
      console.error('[useAuth] Unexpected error in refreshProfile:', error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase])

  useEffect(() => {
    const getUser = async () => {
      console.log('[useAuth] Starting initial user load...')
      
      try {
        console.log('[useAuth] Calling supabase.auth.getUser()')
        const { data: { user }, error } = await supabase.auth.getUser()
        
        console.log('[useAuth] getUser result:', { user: user?.email, error })
        
        if (error) {
          console.error('[useAuth] Initial auth error:', error)
          setLoading(false)
          return
        }
        
        if (user) {
          console.log('[useAuth] User found:', user.email)
          setUser(user)
          // Load profile data immediately with the user ID
          console.log('[useAuth] Loading profile data...')
          await refreshProfile(user.id)
          console.log('[useAuth] Profile load complete')
        } else {
          console.log('[useAuth] No user found')
          setLoading(false)
        }
      } catch (error) {
        console.error('[useAuth] Unexpected error getting user:', error)
      } finally {
        console.log('[useAuth] Setting loading to false')
        setLoading(false)
      }
    }

    console.log('[useAuth] useEffect triggered, calling getUser')
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        if (!mountedRef.current) return // Check if still mounted
        
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
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('[useAuth] User signed out, redirecting to login')
          router.push('/login')
        }
      }
    )

    return () => {
      console.log('[useAuth] Cleaning up auth subscription')
      subscription.unsubscribe()
      // Only set mountedRef to false on actual unmount
      mountedRef.current = false
    }
  }, [supabase, router]) // Removed refreshProfile dependency

  // Separate effect to handle profile refresh when user changes
  useEffect(() => {
    if (user && mountedRef.current) {
      refreshProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, refreshProfile])

  const signOut = async () => {
    console.log('[useAuth] Signing out...')
    try {
      await supabase.auth.signOut()
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