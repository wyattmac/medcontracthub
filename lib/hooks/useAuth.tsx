'use client'

import { createContext, useContext, useEffect, useState } from 'react'
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

  const refreshProfile = async () => {
    console.log('[useAuth] Refreshing profile...')
    
    if (!user) {
      console.log('[useAuth] No user, skipping profile refresh')
      return
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('[useAuth] Profile fetch error:', profileError)
        return
      }

      if (profileData) {
        console.log('[useAuth] Profile loaded:', profileData.id)
        setProfile(profileData)

        if (profileData.company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('*')
            .eq('id', profileData.company_id)
            .single()

          if (companyError) {
            console.error('[useAuth] Company fetch error:', companyError)
            return
          }

          if (companyData) {
            console.log('[useAuth] Company loaded:', companyData.name)
            setCompany(companyData)
          }
        }
      }
    } catch (error) {
      console.error('[useAuth] Unexpected error in refreshProfile:', error)
    }
  }

  useEffect(() => {
    const getUser = async () => {
      console.log('[useAuth] Getting initial user...')
      
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('[useAuth] Initial auth error:', error)
          setLoading(false)
          return
        }
        
        if (user) {
          console.log('[useAuth] User found:', user.email)
          setUser(user)
          await refreshProfile()
        } else {
          console.log('[useAuth] No user found')
        }
      } catch (error) {
        console.error('[useAuth] Unexpected error getting user:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        console.log('[useAuth] Auth state changed:', event)
        
        if (session?.user) {
          console.log('[useAuth] Session user:', session.user.email)
          setUser(session.user)
          await refreshProfile()
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
    }
  }, [supabase, router])

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