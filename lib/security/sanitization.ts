/**
 * Input Sanitization Utilities
 * Prevents XSS attacks by sanitizing user input using DOMPurify
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitization configuration for different contexts
 */
export const sanitizationConfigs = {
  // Strict: Only plain text, no HTML allowed
  text: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  },
  
  // Basic: Allow basic formatting tags only
  basic: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  },
  
  // Rich: Allow more HTML tags for rich content
  rich: {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'br', 'p', 'div', 'span',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img'
    ],
    ALLOWED_ATTR: {
      'a': ['href', 'title'],
      'img': ['src', 'alt', 'title', 'width', 'height']
    },
    KEEP_CONTENT: true,
    ALLOWED_URI_REGEXP: /^https?:\/\//
  }
} as const

/**
 * Sanitize HTML content using DOMPurify
 */
export function sanitizeHtml(
  dirty: string, 
  config: keyof typeof sanitizationConfigs = 'text'
): string {
  if (!dirty || typeof dirty !== 'string') {
    return ''
  }

  try {
    return DOMPurify.sanitize(dirty, sanitizationConfigs[config])
  } catch (error) {
    console.error('Sanitization error:', error)
    // Return empty string on error for safety
    return ''
  }
}

/**
 * Sanitize plain text input (removes all HTML)
 */
export function sanitizeText(input: string): string {
  return sanitizeHtml(input, 'text')
}

/**
 * Sanitize user input for database storage
 * Removes HTML but preserves text content
 */
export function sanitizeForDatabase(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // First pass: remove HTML tags but keep content
  const textOnly = sanitizeHtml(input, 'text')
  
  // Second pass: trim and normalize whitespace
  return textOnly.trim().replace(/\s+/g, ' ')
}

/**
 * Sanitize search queries
 * Removes potentially dangerous characters while preserving search functionality
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return ''
  }

  // Remove HTML and script-like content
  let sanitized = sanitizeText(query)
  
  // Remove SQL injection patterns (basic protection)
  sanitized = sanitized.replace(/['"`;\\]/g, '')
  
  // Remove SQL comment patterns
  sanitized = sanitized.replace(/--/g, '')
  
  // Limit length to prevent DoS
  sanitized = sanitized.slice(0, 500)
  
  return sanitized.trim()
}

/**
 * Sanitize opportunity descriptions and content
 * Allows basic formatting but removes dangerous content
 */
export function sanitizeOpportunityContent(content: string): string {
  return sanitizeHtml(content, 'basic')
}

/**
 * Sanitize URLs to prevent malicious redirects
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return ''
  }

  // Only allow http/https URLs
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return ''
    }
    return parsed.toString()
  } catch {
    return ''
  }
}

/**
 * Sanitize file names for upload
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return ''
  }

  // Remove path traversal attempts
  let sanitized = fileName.replace(/[\/\\:*?"<>|]/g, '_')
  
  // Remove leading dots to prevent hidden files
  sanitized = sanitized.replace(/^\.+/, '')
  
  // Limit length
  sanitized = sanitized.slice(0, 255)
  
  return sanitized.trim()
}

/**
 * Comprehensive input sanitization for API requests
 */
export interface ISanitizedInput {
  [key: string]: any
}

export function sanitizeApiInput(
  input: Record<string, any>,
  fieldConfig: Record<string, 'text' | 'basic' | 'rich' | 'search' | 'url' | 'filename'> = {}
): ISanitizedInput {
  const sanitized: ISanitizedInput = {}

  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) {
      sanitized[key] = value
      continue
    }

    const config = fieldConfig[key] || 'text'

    if (typeof value === 'string') {
      switch (config) {
        case 'text':
          sanitized[key] = sanitizeText(value)
          break
        case 'basic':
          sanitized[key] = sanitizeHtml(value, 'basic')
          break
        case 'rich':
          sanitized[key] = sanitizeHtml(value, 'rich')
          break
        case 'search':
          sanitized[key] = sanitizeSearchQuery(value)
          break
        case 'url':
          sanitized[key] = sanitizeUrl(value)
          break
        case 'filename':
          sanitized[key] = sanitizeFileName(value)
          break
        default:
          sanitized[key] = sanitizeText(value)
      }
    } else if (Array.isArray(value)) {
      // Recursively sanitize arrays
      sanitized[key] = value.map(item => {
        if (typeof item === 'string') {
          const config = fieldConfig[key] || 'text'
          switch (config) {
            case 'search':
              return sanitizeSearchQuery(item)
            case 'url':
              return sanitizeUrl(item)
            case 'filename':
              return sanitizeFileName(item)
            case 'basic':
              return sanitizeHtml(item, 'basic')
            case 'rich':
              return sanitizeHtml(item, 'rich')
            default:
              return sanitizeText(item)
          }
        }
        return item
      })
    } else if (typeof value === 'object') {
      // For nested objects, apply basic text sanitization to string values
      sanitized[key] = sanitizeApiInput(value, fieldConfig)
    } else {
      // Non-string primitives (numbers, booleans) pass through
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Middleware function for route handlers to sanitize request body
 */
export function sanitizeRequestBody(
  body: any,
  fieldConfig?: Record<string, 'text' | 'basic' | 'rich' | 'search' | 'url' | 'filename'>
): any {
  if (!body || typeof body !== 'object') {
    return body
  }

  return sanitizeApiInput(body, fieldConfig)
}

/**
 * React hook for sanitizing form input in real-time
 */
export function useSanitization() {
  return {
    sanitizeText,
    sanitizeHtml,
    sanitizeSearchQuery,
    sanitizeUrl,
    sanitizeFileName,
    sanitizeForDatabase,
    sanitizeOpportunityContent
  }
}