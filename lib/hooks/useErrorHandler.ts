/**
 * Error Handling Hook
 * Provides consistent error handling across the application
 */

'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { logger } from '@/lib/errors/logger'
import { parseError } from '@/lib/errors/utils'
import { AppError, ErrorCode } from '@/lib/errors/types'

interface IErrorHandlerOptions {
  showToast?: boolean
  logError?: boolean
  redirectOnAuth?: boolean
  fallbackMessage?: string
  onError?: (error: any) => void
}

export function useErrorHandler(defaultOptions?: IErrorHandlerOptions) {
  const router = useRouter()

  const handleError = useCallback((
    error: unknown,
    options: IErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      logError = true,
      redirectOnAuth = true,
      fallbackMessage = 'An unexpected error occurred',
      onError
    } = { ...defaultOptions, ...options }

    // Parse error
    const parsedError = parseError(error)

    // Log error
    if (logError) {
      logger.error('Client error handled', error, {
        parsed: parsedError,
        url: window.location.href
      })
    }

    // Handle authentication errors
    if (redirectOnAuth && parsedError.code === ErrorCode.UNAUTHORIZED) {
      toast.error('Please log in to continue')
      router.push('/login')
      return
    }

    // Show toast notification
    if (showToast) {
      const message = getErrorMessage(parsedError, fallbackMessage)
      toast.error(message, {
        description: getErrorDescription(parsedError),
        action: getErrorAction(parsedError, router)
      })
    }

    // Call custom error handler
    if (onError) {
      onError(parsedError)
    }
  }, [router, defaultOptions])

  return { handleError }
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: any, fallback: string): string {
  switch (error.code) {
    case ErrorCode.UNAUTHORIZED:
      return 'Authentication required'
    case ErrorCode.FORBIDDEN:
      return 'Access denied'
    case ErrorCode.RECORD_NOT_FOUND:
      return 'Item not found'
    case ErrorCode.VALIDATION_ERROR:
      return 'Please check your input'
    case ErrorCode.API_RATE_LIMIT:
      return 'Too many requests'
    case ErrorCode.DATABASE_CONNECTION:
      return 'Connection error'
    case ErrorCode.SERVICE_UNAVAILABLE:
      return 'Service temporarily unavailable'
    case ErrorCode.API_TIMEOUT:
      return 'Request timed out'
    default:
      return error.message || fallback
  }
}

/**
 * Get error description for toast
 */
function getErrorDescription(error: any): string | undefined {
  if (error.code === ErrorCode.VALIDATION_ERROR && error.details?.errors) {
    return error.details.errors
      .map((e: any) => e.message)
      .join(', ')
  }
  
  if (error.code === ErrorCode.API_RATE_LIMIT && error.details?.retryAfter) {
    return `Please try again in ${error.details.retryAfter} seconds`
  }
  
  return undefined
}

/**
 * Get error action for toast
 */
function getErrorAction(error: any, router: any): any {
  switch (error.code) {
    case ErrorCode.UNAUTHORIZED:
      return {
        label: 'Log in',
        onClick: () => router.push('/login')
      }
    case ErrorCode.SERVICE_UNAVAILABLE:
    case ErrorCode.DATABASE_CONNECTION:
      return {
        label: 'Retry',
        onClick: () => window.location.reload()
      }
    default:
      return undefined
  }
}

/**
 * Async error handler wrapper
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: IErrorHandlerOptions
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      const { handleError } = useErrorHandler(options)
      handleError(error)
      throw error
    }
  }) as T
}