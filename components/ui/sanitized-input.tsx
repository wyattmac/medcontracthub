/**
 * Sanitized Input Components
 * Input components that automatically sanitize user input to prevent XSS
 */

'use client'

import React, { forwardRef, useCallback } from 'react'
import { Input, InputProps } from './input'
import { Textarea } from './textarea'
import { useSanitization } from '@/lib/security/sanitization'

interface ISanitizedInputProps extends Omit<InputProps, 'onChange'> {
  sanitizationType?: 'text' | 'search' | 'url' | 'filename'
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void
  onSanitizedChange?: (sanitizedValue: string, originalValue: string) => void
}

interface ISanitizedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  sanitizationType?: 'text' | 'basic' | 'rich'
  onChange?: (value: string, event: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSanitizedChange?: (sanitizedValue: string, originalValue: string) => void
}

/**
 * Input component with automatic sanitization
 */
export const SanitizedInput = forwardRef<HTMLInputElement, ISanitizedInputProps>(
  ({ 
    sanitizationType = 'text', 
    onChange, 
    onSanitizedChange,
    ...props 
  }, ref) => {
    const {
      sanitizeText,
      sanitizeSearchQuery,
      sanitizeUrl,
      sanitizeFileName
    } = useSanitization()

    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const originalValue = event.target.value
      let sanitizedValue = originalValue

      // Apply appropriate sanitization based on type
      switch (sanitizationType) {
        case 'search':
          sanitizedValue = sanitizeSearchQuery(originalValue)
          break
        case 'url':
          sanitizedValue = sanitizeUrl(originalValue)
          break
        case 'filename':
          sanitizedValue = sanitizeFileName(originalValue)
          break
        case 'text':
        default:
          sanitizedValue = sanitizeText(originalValue)
          break
      }

      // Update the input value if sanitization changed it
      if (sanitizedValue !== originalValue) {
        event.target.value = sanitizedValue
      }

      // Call callbacks
      onChange?.(sanitizedValue, event)
      onSanitizedChange?.(sanitizedValue, originalValue)
    }, [sanitizationType, onChange, onSanitizedChange, sanitizeText, sanitizeSearchQuery, sanitizeUrl, sanitizeFileName])

    return (
      <Input
        {...props}
        ref={ref}
        onChange={handleChange}
      />
    )
  }
)

SanitizedInput.displayName = 'SanitizedInput'

/**
 * Textarea component with automatic sanitization
 */
export const SanitizedTextarea = forwardRef<HTMLTextAreaElement, ISanitizedTextareaProps>(
  ({
    sanitizationType = 'text',
    onChange,
    onSanitizedChange,
    className,
    ...props
  }, ref) => {
    const {
      sanitizeText,
      sanitizeHtml
    } = useSanitization()

    const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const originalValue = event.target.value
      let sanitizedValue = originalValue

      // Apply appropriate sanitization based on type
      switch (sanitizationType) {
        case 'basic':
          sanitizedValue = sanitizeHtml(originalValue, 'basic')
          break
        case 'rich':
          sanitizedValue = sanitizeHtml(originalValue, 'rich')
          break
        case 'text':
        default:
          sanitizedValue = sanitizeText(originalValue)
          break
      }

      // Update the textarea value if sanitization changed it
      if (sanitizedValue !== originalValue) {
        event.target.value = sanitizedValue
      }

      // Call callbacks
      onChange?.(sanitizedValue, event)
      onSanitizedChange?.(sanitizedValue, originalValue)
    }, [sanitizationType, onChange, onSanitizedChange, sanitizeText, sanitizeHtml])

    return (
      <Textarea
        {...props}
        ref={ref}
        className={className}
        onChange={handleChange}
      />
    )
  }
)

SanitizedTextarea.displayName = 'SanitizedTextarea'

/**
 * Search input with specialized sanitization for search queries
 */
export const SearchInput = forwardRef<HTMLInputElement, Omit<ISanitizedInputProps, 'sanitizationType'>>(
  (props, ref) => {
    return (
      <SanitizedInput
        {...props}
        ref={ref}
        sanitizationType="search"
        placeholder="Search opportunities..."
      />
    )
  }
)

SearchInput.displayName = 'SearchInput'

/**
 * URL input with URL validation and sanitization
 */
export const UrlInput = forwardRef<HTMLInputElement, Omit<ISanitizedInputProps, 'sanitizationType'>>(
  (props, ref) => {
    return (
      <SanitizedInput
        {...props}
        ref={ref}
        sanitizationType="url"
        type="url"
        placeholder="https://example.com"
      />
    )
  }
)

UrlInput.displayName = 'UrlInput'

/**
 * File name input with file name sanitization
 */
export const FileNameInput = forwardRef<HTMLInputElement, Omit<ISanitizedInputProps, 'sanitizationType'>>(
  (props, ref) => {
    return (
      <SanitizedInput
        {...props}
        ref={ref}
        sanitizationType="filename"
        placeholder="filename.ext"
      />
    )
  }
)

FileNameInput.displayName = 'FileNameInput'

/**
 * Hook for form validation with sanitization
 */
export function useSanitizedForm() {
  const sanitization = useSanitization()

  const sanitizeFormData = useCallback((data: Record<string, any>) => {
    const sanitized: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Apply basic text sanitization to all string fields by default
        sanitized[key] = sanitization.sanitizeText(value)
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }, [sanitization])

  const validateAndSanitize = useCallback((
    data: Record<string, any>,
    config: Record<string, 'text' | 'basic' | 'rich' | 'search' | 'url' | 'filename'> = {}
  ) => {
    const sanitized: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        const sanitizationType = config[key] || 'text'
        
        switch (sanitizationType) {
          case 'search':
            sanitized[key] = sanitization.sanitizeSearchQuery(value)
            break
          case 'url':
            sanitized[key] = sanitization.sanitizeUrl(value)
            break
          case 'filename':
            sanitized[key] = sanitization.sanitizeFileName(value)
            break
          case 'basic':
            sanitized[key] = sanitization.sanitizeHtml(value, 'basic')
            break
          case 'rich':
            sanitized[key] = sanitization.sanitizeHtml(value, 'rich')
            break
          case 'text':
          default:
            sanitized[key] = sanitization.sanitizeText(value)
            break
        }
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }, [sanitization])

  return {
    sanitizeFormData,
    validateAndSanitize,
    ...sanitization
  }
}