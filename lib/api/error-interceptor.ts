/**
 * Client-side API Error Interceptor
 * Provides actionable error messages and debugging info
 */

import { AppError, ErrorCode, ExternalAPIError, RateLimitError, ValidationError } from '@/lib/errors/types'
import { errorReporter } from '@/lib/errors/error-reporter'
import { toast } from '@/lib/hooks/useToast'

interface ApiErrorResponse {
  error: {
    message: string
    code: ErrorCode
    requestId?: string
    timestamp?: string
    debugging?: {
      hint: string
      possibleCauses: string[]
      suggestedActions: string[]
      relatedFiles: string[]
    }
    details?: any
  }
}

export class ApiErrorInterceptor {
  /**
   * Process API error and provide actionable feedback
   */
  static async handleError(
    error: unknown,
    context?: {
      operation?: string
      resource?: string
      showToast?: boolean
      throwError?: boolean
    }
  ): Promise<AppError> {
    const { operation = 'API request', resource, showToast = true, throwError = true } = context || {}
    
    let appError: AppError
    let userMessage: string
    let debugInfo: any = {}
    
    // Handle fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      appError = new ExternalAPIError(
        'Network',
        'Network connection failed',
        ErrorCode.API_CONNECTION,
        {
          originalError: error.message,
          hint: 'Check your internet connection or try again later'
        }
      )
      userMessage = 'Connection error. Please check your internet and try again.'
      
    // Handle Response errors
    } else if (error instanceof Response) {
      try {
        const errorData: ApiErrorResponse = await error.json()
        const { error: apiError } = errorData
        
        // Create appropriate error based on code
        switch (apiError.code) {
          case ErrorCode.API_RATE_LIMIT:
            appError = new RateLimitError(
              apiError.message,
              apiError.details?.retryAfter
            )
            userMessage = `Rate limit exceeded. Please wait ${apiError.details?.retryAfter || 60} seconds.`
            break
            
          case ErrorCode.VALIDATION_ERROR:
            appError = new ValidationError(
              apiError.message,
              apiError.details
            )
            userMessage = this.getValidationErrorMessage(apiError.details)
            break
            
          case ErrorCode.UNAUTHORIZED:
            appError = new AppError(
              ErrorCode.UNAUTHORIZED,
              apiError.message,
              401,
              apiError.details
            )
            userMessage = 'Please log in to continue.'
            break
            
          case ErrorCode.FORBIDDEN:
            appError = new AppError(
              ErrorCode.FORBIDDEN,
              apiError.message,
              403,
              apiError.details
            )
            userMessage = 'You don\'t have permission to perform this action.'
            break
            
          case ErrorCode.RECORD_NOT_FOUND:
            appError = new AppError(
              ErrorCode.RECORD_NOT_FOUND,
              apiError.message,
              404,
              apiError.details
            )
            userMessage = `${resource || 'Item'} not found.`
            break
            
          default:
            appError = new AppError(
              apiError.code || ErrorCode.INTERNAL_ERROR,
              apiError.message,
              error.status,
              apiError.details
            )
            userMessage = apiError.message || 'An unexpected error occurred.'
        }
        
        // Store debugging info if available
        debugInfo = apiError.debugging || {}
        
      } catch (parseError) {
        // If response isn't JSON
        appError = new AppError(
          ErrorCode.INTERNAL_ERROR,
          `Server error (${error.status})`,
          error.status,
          { parseError: parseError }
        )
        userMessage = 'Server error. Please try again later.'
      }
      
    // Handle AppError instances
    } else if (error instanceof AppError) {
      appError = error
      userMessage = this.getUserFriendlyMessage(error)
      
    // Handle generic errors
    } else if (error instanceof Error) {
      appError = new AppError(
        ErrorCode.UNKNOWN_ERROR,
        error.message,
        500,
        { originalError: error }
      )
      userMessage = 'An unexpected error occurred.'
      
    // Handle unknown errors
    } else {
      appError = new AppError(
        ErrorCode.UNKNOWN_ERROR,
        'Unknown error',
        500,
        { originalError: error }
      )
      userMessage = 'An unexpected error occurred.'
    }
    
    // Report error with full context
    const errorReport = errorReporter.report(appError, {
      url: window.location.href,
      method: 'Client-side',
      operation,
      resource,
      userAgent: navigator.userAgent,
      ...debugInfo
    })
    
    // Show toast notification if enabled
    if (showToast) {
      this.showErrorToast(userMessage, appError, debugInfo)
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 API Error: ${operation}`)
      console.error('Error:', appError)
      console.log('User Message:', userMessage)
      if (debugInfo.hint) console.log('Hint:', debugInfo.hint)
      if (debugInfo.suggestedActions) console.log('Actions:', debugInfo.suggestedActions)
      console.log('Report:', errorReport)
      console.groupEnd()
    }
    
    // Throw error if requested
    if (throwError) {
      throw appError
    }
    
    return appError
  }
  
  /**
   * Get user-friendly message based on error type
   */
  private static getUserFriendlyMessage(error: AppError): string {
    switch (error.code) {
      case ErrorCode.DATABASE_CONNECTION:
        return 'Unable to connect to the database. Please try again.'
      case ErrorCode.DATABASE_TIMEOUT:
        return 'The request took too long. Please try again.'
      case ErrorCode.API_TIMEOUT:
        return 'The server is taking too long to respond. Please try again.'
      case ErrorCode.EXTERNAL_SERVICE_ERROR:
        return 'An external service is unavailable. Please try again later.'
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 'The service is temporarily unavailable. Please try again later.'
      default:
        return error.message || 'An error occurred. Please try again.'
    }
  }
  
  /**
   * Format validation errors for display
   */
  private static getValidationErrorMessage(details: any): string {
    if (!details?.errors || !Array.isArray(details.errors)) {
      return 'Please check your input and try again.'
    }
    
    const errors = details.errors
      .map((err: any) => {
        const field = err.path?.join('.') || 'field'
        return `${field}: ${err.message}`
      })
      .join(', ')
      
    return `Validation failed: ${errors}`
  }
  
  /**
   * Show error toast with appropriate styling and actions
   */
  private static showErrorToast(message: string, error: AppError, debugInfo: any) {
    const isDevMode = process.env.NODE_ENV === 'development'
    
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive',
      duration: error.code === ErrorCode.API_RATE_LIMIT ? 10000 : 5000,
      
      // Add debug action in development
      ...(isDevMode && debugInfo.hint && {
        action: {
          label: 'Debug',
          onClick: () => {
            console.group('🔍 Error Debug Info')
            console.log('Hint:', debugInfo.hint)
            console.log('Possible Causes:', debugInfo.possibleCauses)
            console.log('Suggested Actions:', debugInfo.suggestedActions)
            console.log('Related Files:', debugInfo.relatedFiles)
            console.log('Full Error:', error)
            console.groupEnd()
          }
        }
      })
    })
  }
}

/**
 * Fetch wrapper with automatic error handling
 */
export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit & { 
    errorContext?: Parameters<typeof ApiErrorInterceptor.handleError>[1] 
  }
): Promise<Response> {
  const { errorContext, ...fetchOptions } = options || {}
  
  try {
    const response = await fetch(url, fetchOptions)
    
    if (!response.ok) {
      await ApiErrorInterceptor.handleError(response, {
        operation: `${fetchOptions.method || 'GET'} ${url}`,
        ...errorContext
      })
    }
    
    return response
  } catch (error) {
    await ApiErrorInterceptor.handleError(error, {
      operation: `${fetchOptions?.method || 'GET'} ${url}`,
      ...errorContext
    })
    throw error // This won't be reached due to handleError throwing
  }
}

/**
 * API client with built-in error handling
 */
export const api = {
  async get<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetchWithErrorHandling(url, {
      ...options,
      method: 'GET',
      errorContext: { operation: 'Fetching data' }
    })
    return response.json()
  },
  
  async post<T>(url: string, data: any, options?: RequestInit): Promise<T> {
    const response = await fetchWithErrorHandling(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: JSON.stringify(data),
      errorContext: { operation: 'Saving data' }
    })
    return response.json()
  },
  
  async put<T>(url: string, data: any, options?: RequestInit): Promise<T> {
    const response = await fetchWithErrorHandling(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: JSON.stringify(data),
      errorContext: { operation: 'Updating data' }
    })
    return response.json()
  },
  
  async delete<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetchWithErrorHandling(url, {
      ...options,
      method: 'DELETE',
      errorContext: { operation: 'Deleting data' }
    })
    return response.json()
  }
}