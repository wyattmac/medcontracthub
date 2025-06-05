/**
 * Mock Auth Provider
 * For development without Supabase connection
 */

'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

interface MockProfile {
  id: string
  email: string
  full_name: string
  company_id: string
  role: 'admin' | 'user'
  onboarding_completed: boolean
}

interface MockCompany {
  id: string
  name: string
  naics_codes: string[]
  certifications: string[]
  address_line1: string
  city: string
  state: string
  zip_code: string
}

interface IMockAuthContext {
  user: User | null
  profile: MockProfile | null
  company: MockCompany | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const MockAuthContext = createContext<IMockAuthContext | undefined>(undefined)

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<MockProfile | null>(null)
  const [company, setCompany] = useState<MockCompany | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check for mock session in localStorage
    const checkMockSession = () => {
      try {
        const mockSession = localStorage.getItem('mock-auth-session')
        const mockUser = localStorage.getItem('mock-auth-user')

        if (mockSession && mockUser) {
          const sessionData = JSON.parse(mockSession)
          const userData = JSON.parse(mockUser)

          // Check if session is still valid
          if (sessionData.expires_at > Date.now()) {
            setUser(userData as User)
            
            // Create mock profile and company
            const mockProfile: MockProfile = {
              id: userData.id,
              email: userData.email,
              full_name: userData.user_metadata?.full_name || 'Dev User',
              company_id: 'mock-company-id',
              role: 'admin',
              onboarding_completed: true
            }

            const mockCompany: MockCompany = {
              id: 'mock-company-id',
              name: 'Mock Medical Supplies Co.',
              naics_codes: ['339112', '423450', '621999'],
              certifications: ['small_business', 'wosb'],
              address_line1: '123 Development St',
              city: 'San Francisco',
              state: 'CA',
              zip_code: '94105'
            }

            setProfile(mockProfile)
            setCompany(mockCompany)
          } else {
            // Session expired, clear it
            localStorage.removeItem('mock-auth-session')
            localStorage.removeItem('mock-auth-user')
          }
        }
      } catch (error) {
        console.error('[MockAuth] Error checking session:', error)
        localStorage.removeItem('mock-auth-session')
        localStorage.removeItem('mock-auth-user')
      }

      setLoading(false)
    }

    checkMockSession()

    // Listen for storage changes (for cross-tab login)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mock-auth-session' || e.key === 'mock-auth-user') {
        checkMockSession()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const signOut = async () => {
    localStorage.removeItem('mock-auth-session')
    localStorage.removeItem('mock-auth-user')
    setUser(null)
    setProfile(null)
    setCompany(null)
    router.push('/login')
  }

  const refreshProfile = async () => {
    // Mock refresh - in real app this would fetch from database
    console.log('[MockAuth] Profile refresh called')
  }

  const value = {
    user,
    profile,
    company,
    loading,
    signOut,
    refreshProfile
  }

  return (
    <MockAuthContext.Provider value={value}>
      {children}
    </MockAuthContext.Provider>
  )
}

export function useMockAuth() {
  const context = useContext(MockAuthContext)
  if (context === undefined) {
    throw new Error('useMockAuth must be used within a MockAuthProvider')
  }
  return context
}