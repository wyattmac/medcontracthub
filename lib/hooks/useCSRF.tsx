/**
 * Client-side CSRF Protection Hook
 * Provides CSRF token management for React components
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

interface ICSRFState {
  token: string | null
  loading: boolean
  error: string | null
}

export function useCSRF() {
  const [state, setState] = useState<ICSRFState>({
    token: null,
    loading: true,
    error: null
  })

  // Get CSRF token from meta tag or fetch from API
  const fetchCSRFToken = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      // First try to get token from meta tag (server-rendered)
      const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
      if (metaToken) {
        setState({ token: metaToken, loading: false, error: null })
        return metaToken
      }

      // Fallback: fetch from API
      const response = await fetch('/api/csrf', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token')
      }

      const data = await response.json()
      const token = data.csrfToken || response.headers.get('X-CSRF-Token')

      if (!token) {
        throw new Error('No CSRF token received')
      }

      setState({ token, loading: false, error: null })
      return token

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get CSRF token'
      setState({ token: null, loading: false, error: errorMessage })
      console.error('CSRF token fetch error:', error)
      return null
    }
  }, [])

  // Initialize CSRF token on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchCSRFToken()
    }
  }, [fetchCSRFToken])

  // Get headers for authenticated requests
  const getCSRFHeaders = useCallback(() => {
    if (!state.token) {
      return {}
    }

    return {
      'X-CSRF-Token': state.token,
      'X-Requested-With': 'XMLHttpRequest' // Additional CSRF protection
    }
  }, [state.token])

  // Enhanced fetch with CSRF protection
  const csrfFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    // Ensure we have a token for state-changing requests
    const method = options.method?.toUpperCase() || 'GET'
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

    if (isStateChanging && !state.token) {
      // Try to get token if we don't have one
      const token = await fetchCSRFToken()
      if (!token) {
        throw new Error('Unable to obtain CSRF token for request')
      }
    }

    // Merge CSRF headers with existing headers
    const headers = new Headers(options.headers)
    
    if (isStateChanging && state.token) {
      headers.set('X-CSRF-Token', state.token)
      headers.set('X-Requested-With', 'XMLHttpRequest')
    }

    // Ensure credentials are included for cookie-based auth
    const requestOptions: RequestInit = {
      ...options,
      headers,
      credentials: options.credentials || 'include'
    }

    try {
      const response = await fetch(url, requestOptions)

      // If we get a CSRF error, try to refresh token and retry once
      if (response.status === 403 && isStateChanging) {
        const errorData = await response.text()
        if (errorData.includes('CSRF') || errorData.includes('csrf')) {
          console.warn('CSRF token expired, refreshing...')
          
          const newToken = await fetchCSRFToken()
          if (newToken) {
            headers.set('X-CSRF-Token', newToken)
            return fetch(url, { ...requestOptions, headers })
          }
        }
      }

      return response
    } catch (error) {
      console.error('CSRF fetch error:', error)
      throw error
    }
  }, [state.token, fetchCSRFToken])

  // Form data helper with CSRF token
  const addCSRFToFormData = useCallback((formData: FormData) => {
    if (state.token) {
      formData.append('_csrf', state.token)
    }
    return formData
  }, [state.token])

  // Get CSRF input field for forms
  const getCSRFInput = useCallback(() => {
    if (!state.token) return null

    return {
      type: 'hidden' as const,
      name: '_csrf',
      value: state.token
    }
  }, [state.token])

  return {
    // State
    token: state.token,
    loading: state.loading,
    error: state.error,
    
    // Methods
    refreshToken: fetchCSRFToken,
    getHeaders: getCSRFHeaders,
    fetch: csrfFetch,
    addToFormData: addCSRFToFormData,
    getInputProps: getCSRFInput,
    
    // Utilities
    isReady: !state.loading && !!state.token
  }
}

/**
 * Higher-order component for CSRF protection
 */
export function withCSRFProtection<P extends object>(
  Component: React.ComponentType<P>
) {
  return function CSRFProtectedComponent(props: P) {
    const csrf = useCSRF()

    // Show loading state while CSRF token is being fetched
    if (csrf.loading) {
      return <div>Loading security token...</div>;
    }

    // Show error state if CSRF token failed to load
    if (csrf.error) {
      return (
        <div className="error">
          Security token error: {csrf.error}
          <button onClick={csrf.refreshToken}>Retry</button>
        </div>
      )
    }

    // Render component with CSRF context
    return <Component {...props} />
  }
}

/**
 * Hook for form submissions with CSRF protection
 */
export function useCSRFForm() {
  const csrf = useCSRF()

  const submitForm = useCallback(async (
    url: string,
    formData: FormData | Record<string, any>,
    options: RequestInit = {}
  ) => {
    if (!csrf.token) {
      throw new Error('CSRF token not available')
    }

    let body: BodyInit
    const headers = new Headers(options.headers)

    if (formData instanceof FormData) {
      csrf.addToFormData(formData)
      body = formData
    } else {
      // JSON submission
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify({
        ...formData,
        _csrf: csrf.token
      })
    }

    return csrf.fetch(url, {
      method: 'POST',
      ...options,
      headers,
      body
    })
  }, [csrf])

  return {
    submitForm,
    token: csrf.token,
    loading: csrf.loading,
    error: csrf.error,
    getInputProps: csrf.getInputProps
  }
}