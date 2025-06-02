/**
 * React Query Providers
 * Following TanStack Query patterns for Next.js SSR
 * Based on Context7 research
 */

'use client'

import {
  isServer,
  QueryClient,
  QueryClientProvider,
  defaultShouldDehydrateQuery,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster, toast } from 'sonner'
import * as React from 'react'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { logger } from '@/lib/errors/logger'
import { parseError } from '@/lib/errors/utils'
import { AppError, ErrorCode } from '@/lib/errors/types'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
        // Garbage collection time
        gcTime: 5 * 60 * 1000, // 5 minutes
        // Add timeout for queries to prevent hanging requests
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500) {
            return false
          }
          // Limit retries
          return failureCount < 2
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Network timeout
        networkMode: 'online',
      },
      mutations: {
        retry: 1,
        networkMode: 'online',
        onError: (error) => {
          const parsedError = parseError(error)
          logger.error('Mutation error', error)
          
          // Show user-friendly error messages
          const message = getErrorMessage(parsedError)
          toast.error(message)
        },
      },
      dehydrate: {
        // include pending queries in dehydration
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
        shouldRedactErrors: (error) => {
          // We should not catch Next.js server errors
          // as that's how Next.js detects dynamic pages
          // so we cannot redact them.
          // Next.js also automatically redacts errors for us
          // with better digests.
          return false
        },
      },
    },
    logger: {
      log: (message) => logger.debug(message),
      warn: (message) => logger.warn(message),
      error: (message) => logger.error('Query Client Error', message),
    },
  })
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred'
  
  // Handle specific error codes
  switch (error.code) {
    case ErrorCode.UNAUTHORIZED:
      return 'Please log in to continue'
    case ErrorCode.FORBIDDEN:
      return 'You don\'t have permission to do that'
    case ErrorCode.RECORD_NOT_FOUND:
      return 'The requested item was not found'
    case ErrorCode.VALIDATION_ERROR:
      return error.details?.errors?.[0]?.message || 'Please check your input'
    case ErrorCode.API_RATE_LIMIT:
      return 'Too many requests. Please try again later'
    case ErrorCode.DATABASE_CONNECTION:
      return 'Connection error. Please check your internet connection'
    case ErrorCode.SERVICE_UNAVAILABLE:
      return 'Service temporarily unavailable. Please try again later'
    default:
      return error.message || 'An unexpected error occurred'
  }
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

interface IProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: IProvidersProps) {
  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient()

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logger.error('Application error boundary triggered', error, {
          componentStack: errorInfo.componentStack,
          digest: (errorInfo as any).digest
        })
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
        <Toaster 
          position="top-right" 
          richColors 
          toastOptions={{
            duration: 5000,
            style: {
              background: 'var(--background)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
            },
            error: {
              duration: 7000,
            },
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export { getQueryClient }