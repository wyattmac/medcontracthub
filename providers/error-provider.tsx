'use client'

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { errorReporter } from '@/lib/errors/error-reporter'
import { EnhancedErrorBoundary } from '@/components/ui/enhanced-error-boundary'
import { usePathname } from 'next/navigation'
// import { useAuth } from '@/lib/hooks/useAuth'

interface ErrorContextValue {
  reportError: (error: Error, context?: any) => void
  clearErrors: () => void
}

const ErrorContext = createContext<ErrorContextValue | undefined>(undefined)

export function ErrorProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // const { user } = useAuth()
  
  // useEffect(() => {
  //   // Set global context when user changes
  //   if (user) {
  //     errorReporter.setGlobalContext('userId', user.id)
  //     errorReporter.setGlobalContext('userEmail', user.email)
  //   }
  // }, [user])
  
  useEffect(() => {
    // Set global context when route changes
    errorReporter.setGlobalContext('currentPath', pathname)
  }, [pathname])
  
  useEffect(() => {
    // Global error handler for unhandled errors
    const handleUnhandledError = (event: ErrorEvent) => {
      errorReporter.report(event.error || new Error(event.message), {
        url: event.filename,
        errorBoundary: 'global-unhandled',
        method: 'window.onerror'
      })
    }
    
    // Global handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason))
        
      errorReporter.report(error, {
        errorBoundary: 'global-unhandled-promise',
        method: 'unhandledrejection'
      })
    }
    
    // Add global error listeners
    window.addEventListener('error', handleUnhandledError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    
    // Log when app starts
    console.log(
      '%c🚀 MedContractHub Error Handling Active',
      'color: #10b981; font-weight: bold; font-size: 14px;'
    )
    console.log(
      '%cErrors will be reported with detailed debugging info',
      'color: #6b7280; font-size: 12px;'
    )
    
    return () => {
      window.removeEventListener('error', handleUnhandledError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])
  
  const reportError = (error: Error, context?: any) => {
    errorReporter.report(error, {
      ...context,
      manualReport: true,
      reportedAt: new Date().toISOString()
    })
  }
  
  const clearErrors = () => {
    // Clear any stored error state if needed
    console.log('Errors cleared')
  }
  
  return (
    <ErrorContext.Provider value={{ reportError, clearErrors }}>
      <EnhancedErrorBoundary name="RootErrorBoundary">
        {children}
      </EnhancedErrorBoundary>
    </ErrorContext.Provider>
  )
}

export function useError() {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error('useError must be used within ErrorProvider')
  }
  return context
}

/**
 * HOC to wrap components with error handling
 */
export function withErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  name?: string
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary name={name || Component.displayName || Component.name}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorHandling(${Component.displayName || Component.name || 'Component'})`
  
  return WrappedComponent
}