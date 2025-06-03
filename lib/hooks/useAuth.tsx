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
  refreshProfile: () => Promise<void>
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    console.log('[useAuth] Refreshing profile...')
    
    if (!user || !mountedRef.current) {
      console.log('[useAuth] No user or component unmounted, skipping profile refresh')
      return
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id as any)
        .single()

      if (!mountedRef.current) return // Check if still mounted after async operation

      if (profileError || !profileData) {
        console.error('[useAuth] Profile fetch error:', profileError)
        return
      }

      console.log('[useAuth] Profile loaded:', (profileData as any).id)
      setProfile(profileData as any) // Type assertion for database schema compatibility

      if ((profileData as any).company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', (profileData as any).company_id)
          .single()

        if (!mountedRef.current) return // Check if still mounted after async operation

        if (companyError || !companyData) {
          console.error('[useAuth] Company fetch error:', companyError)
          return
        }

        console.log('[useAuth] Company loaded:', (companyData as any).name)
        setCompany(companyData as any) // Type assertion for database schema compatibility
      }
    } catch (error) {
      console.error('[useAuth] Unexpected error in refreshProfile:', error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase])

  useEffect(() => {
    const getUser = async () => {
      console.log('[useAuth] Getting initial user...')
      
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (!mountedRef.current) return // Check if still mounted
        
        if (error) {
          console.error('[useAuth] Initial auth error:', error)
          setLoading(false)
          return
        }
        
        if (user) {
          console.log('[useAuth] User found:', user.email)
          setUser(user)
          // Don't call refreshProfile here - it will be called by the auth state change handler
        } else {
          console.log('[useAuth] No user found')
        }
      } catch (error) {
        console.error('[useAuth] Unexpected error getting user:', error)
      } finally {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

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
      mountedRef.current = false
      subscription.unsubscribe()
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