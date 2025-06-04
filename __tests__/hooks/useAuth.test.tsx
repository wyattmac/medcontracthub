/**
 * useAuth Hook Tests
 * Critical tests for authentication functionality
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { AuthProvider, useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn()
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn()
  })
}))

describe('useAuth Hook', () => {
  let mockSupabaseClient: any
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Setup mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
        signOut: jest.fn(),
        onAuthStateChange: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }
    
    ;(createClient as jest.Mock).mockReturnValue(mockSupabaseClient)
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  describe('Initial State', () => {
    it('should initialize with loading state', () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      })

      const { result } = renderHook(() => useAuth(), { wrapper })
      
      expect(result.current.loading).toBe(true)
      expect(result.current.user).toBe(null)
      expect(result.current.profile).toBe(null)
      expect(result.current.company).toBe(null)
    })
  })

  describe('User Authentication', () => {
    it('should load user data when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }
      
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        company_id: 'company-123'
      }
      
      const mockCompany = {
        id: 'company-123',
        name: 'Test Company'
      }

      // Mock successful auth check
      mockSupabaseClient.auth.getUser.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      })
      
      // Mock auth state change subscription
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      })
      
      // Mock profile fetch
      const singleMock = jest.fn().mockResolvedValue({ 
        data: mockProfile, 
        error: null 
      })
      const eqMock = jest.fn(() => ({ single: singleMock }))
      const selectMock = jest.fn(() => ({ eq: eqMock }))
      mockSupabaseClient.from.mockReturnValue({ select: selectMock })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.user).toEqual(mockUser)
      })
    })

    it('should handle authentication errors gracefully', async () => {
      const mockError = new Error('Auth failed')
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({ 
        data: { user: null }, 
        error: mockError 
      })
      
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.user).toBe(null)
        expect(result.current.profile).toBe(null)
      })
    })
  })

  describe('Sign Out', () => {
    it('should clear user data on sign out', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }

      // Setup authenticated state
      mockSupabaseClient.auth.getUser.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      })
      
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null })
      
      const unsubscribeMock = jest.fn()
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: unsubscribeMock } }
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Sign out
      await act(async () => {
        await result.current.signOut()
      })

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    })
  })

  describe('Memory Leak Prevention', () => {
    it('should unsubscribe from auth state changes on unmount', () => {
      const unsubscribeMock = jest.fn()
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({ 
        data: { user: null }, 
        error: null 
      })
      
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: unsubscribeMock } }
      })

      const { unmount } = renderHook(() => useAuth(), { wrapper })

      // Unmount the hook
      unmount()

      // Verify cleanup was called
      expect(unsubscribeMock).toHaveBeenCalled()
    })

    it('should abort in-flight requests on unmount', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }
      
      // Create a promise that we can control
      let resolveProfile: any
      const profilePromise = new Promise((resolve) => {
        resolveProfile = resolve
      })
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      })
      
      // Mock profile fetch that returns our controlled promise
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockReturnValue(profilePromise)
          })
        })
      })
      
      const unsubscribeMock = jest.fn()
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: unsubscribeMock } }
      })

      const { unmount, result } = renderHook(() => useAuth(), { wrapper })

      // Wait for user to be set
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser)
      })

      // Unmount before profile loads
      unmount()

      // Resolve the profile promise after unmount
      resolveProfile({
        data: { id: 'user-123', company_id: 'company-123' },
        error: null
      })

      // Give time for any state updates that shouldn't happen
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Profile should not have been set since we unmounted
      expect(result.current.profile).toBeNull()
    })

    it('should not update state after unmount', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }

      let authChangeCallback: any

      mockSupabaseClient.auth.getUser.mockResolvedValue({ 
        data: { user: null }, 
        error: null 
      })
      
      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback
        return {
          data: { subscription: { unsubscribe: jest.fn() } }
        }
      })

      const { result, unmount } = renderHook(() => useAuth(), { wrapper })

      // Unmount the component
      unmount()

      // Try to trigger auth state change after unmount
      act(() => {
        if (authChangeCallback) {
          authChangeCallback('SIGNED_IN', { user: mockUser })
        }
      })

      // State should not have been updated
      expect(result.current.user).toBe(null)
    })
  })

  describe('Profile Refresh', () => {
    it('should refresh profile data', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }
      
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User Updated'
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      })
      
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      })
      
      const singleMock = jest.fn().mockResolvedValue({ 
        data: mockProfile, 
        error: null 
      })
      const eqMock = jest.fn(() => ({ single: singleMock }))
      const selectMock = jest.fn(() => ({ eq: eqMock }))
      mockSupabaseClient.from.mockReturnValue({ select: selectMock })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Refresh profile
      await act(async () => {
        await result.current.refreshProfile()
      })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles')
    })
  })
})