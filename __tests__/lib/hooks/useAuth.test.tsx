/**
 * useAuth hook tests
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/lib/hooks/useAuth'
import { ReactNode } from 'react'

// Mock router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush })
}))

// Mock Supabase
const mockAuthStateChange = jest.fn()
const mockSignOut = jest.fn()
const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
      onAuthStateChange: mockAuthStateChange
    },
    from: mockFrom
  })
}))

// Mock Sentry
jest.mock('@/lib/monitoring/sentry', () => ({
  setUserContext: jest.fn(),
  clearUserContext: jest.fn()
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock implementations
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null
    })
    
    mockAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })
    
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: null
      })
    })
  })

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBe(null)
    expect(result.current.profile).toBe(null)
    expect(result.current.company).toBe(null)
  })

  it('should set user when authenticated', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
  })

  it('should load user profile', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }
    
    const mockProfile = {
      id: 'profile-123',
      user_id: 'user-123',
      name: 'Test User',
      company_id: 'company-123'
    }

    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    // Mock profile query
    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null
      })
    }
    mockFrom.mockReturnValue(mockProfileQuery)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.profile).toEqual(mockProfile)
  })

  it('should load company information', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }
    
    const mockProfile = {
      id: 'profile-123',
      user_id: 'user-123',
      name: 'Test User',
      company_id: 'company-123'
    }

    const mockCompany = {
      id: 'company-123',
      name: 'Test Company',
      industry: 'Healthcare'
    }

    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    // Mock profile and company queries
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProfile,
          error: null
        })
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockCompany,
          error: null
        })
      })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.company).toEqual(mockCompany)
  })

  it('should handle sign out', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('should handle auth errors gracefully', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Auth error')
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBe(null)
  })

  it('should refresh profile data', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'profile-123', name: 'Updated Name' },
        error: null
      })
    }
    mockFrom.mockReturnValue(mockProfileQuery)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    await act(async () => {
      await result.current.refreshProfile()
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
  })

  it('should handle auth state changes', async () => {
    let authCallback: any = null
    
    mockAuthStateChange.mockImplementation((callback) => {
      authCallback = callback
      return {
        data: { subscription: { unsubscribe: jest.fn() } }
      }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    // Simulate sign in event
    if (authCallback) {
      act(() => {
        authCallback('SIGNED_IN', {
          user: { id: 'user-123', email: 'test@example.com' }
        })
      })
    }

    await waitFor(() => {
      expect(result.current.user).toBeTruthy()
    })
  })

  it('should redirect on sign out', async () => {
    let authCallback: any = null
    
    mockAuthStateChange.mockImplementation((callback) => {
      authCallback = callback
      return {
        data: { subscription: { unsubscribe: jest.fn() } }
      }
    })

    renderHook(() => useAuth(), { wrapper })

    // Simulate sign out event
    if (authCallback) {
      act(() => {
        authCallback('SIGNED_OUT', { session: null })
      })
    }

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('should set Sentry user context on login', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    const { setUserContext } = require('@/lib/monitoring/sentry')

    renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(setUserContext).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'test@example.com'
      })
    })
  })

  it('should clear Sentry context on logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    const { clearUserContext } = require('@/lib/monitoring/sentry')

    await act(async () => {
      await result.current.signOut()
    })

    expect(clearUserContext).toHaveBeenCalled()
  })
})