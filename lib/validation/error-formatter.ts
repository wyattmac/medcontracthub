import { z } from 'zod'
import { ERROR_MESSAGES } from './error-messages'

/**
 * User-friendly error type
 */
export interface UserFriendlyError {
  message: string
  fields: Record<string, string | string[]>
  summary?: string
}

/**
 * Format Zod error into user-friendly format
 */
export function formatZodError(error: z.ZodError): UserFriendlyError {
  const fields: Record<string, string | string[]> = {}
  const fieldErrors: Record<string, string[]> = {}
  
  // Group errors by path
  error.errors.forEach(err => {
    const path = err.path.join('.')
    if (!fieldErrors[path]) {
      fieldErrors[path] = []
    }
    
    const message = getFieldError(err, path)
    if (message && !fieldErrors[path].includes(message)) {
      fieldErrors[path].push(message)
    }
  })
  
  // Convert to final format
  Object.entries(fieldErrors).forEach(([path, errors]) => {
    fields[path] = errors.length === 1 ? errors[0] : errors
  })
  
  // Generate summary message
  const errorCount = Object.keys(fields).length
  const summary = errorCount === 1 
    ? 'Please correct the error below'
    : `Please correct the ${errorCount} errors below`
  
  return {
    message: 'Validation failed',
    fields,
    summary
  }
}

/**
 * Get user-friendly error message for a specific Zod issue
 */
function getFieldError(issue: z.ZodIssue, fieldPath: string): string {
  const field = fieldPath || 'value'
  
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.expected === 'string') {
        return ERROR_MESSAGES.required(field)
      }
      if (issue.expected === 'number') {
        return ERROR_MESSAGES.notNumber(field)
      }
      if (issue.expected === 'date') {
        return ERROR_MESSAGES.invalidDate(field)
      }
      return ERROR_MESSAGES.invalidValue(field)
    
    case z.ZodIssueCode.invalid_string:
      switch (issue.validation) {
        case 'email':
          return ERROR_MESSAGES.invalidEmail()
        case 'url':
          return ERROR_MESSAGES.invalidUrl()
        case 'uuid':
          return ERROR_MESSAGES.invalidUuid()
        case 'datetime':
          return ERROR_MESSAGES.invalidDate(field)
        case 'regex':
          return getRegexError(field, issue)
        default:
          return ERROR_MESSAGES.invalidFormat(field)
      }
    
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return ERROR_MESSAGES.tooShort(field, issue.minimum as number)
      }
      if (issue.type === 'number') {
        return ERROR_MESSAGES.tooSmall(field, issue.minimum as number)
      }
      if (issue.type === 'array') {
        return ERROR_MESSAGES.arrayTooShort(field, issue.minimum as number)
      }
      return ERROR_MESSAGES.invalidValue(field)
    
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return ERROR_MESSAGES.tooLong(field, issue.maximum as number)
      }
      if (issue.type === 'number') {
        return ERROR_MESSAGES.tooBig(field, issue.maximum as number)
      }
      if (issue.type === 'array') {
        return ERROR_MESSAGES.arrayTooLong(field, issue.maximum as number)
      }
      return ERROR_MESSAGES.invalidValue(field)
    
    case z.ZodIssueCode.invalid_enum_value:
      return ERROR_MESSAGES.invalidSelection(field, issue.options as string[])
    
    case z.ZodIssueCode.custom:
      return issue.message || ERROR_MESSAGES.invalidValue(field)
    
    default:
      return issue.message || ERROR_MESSAGES.invalidValue(field)
  }
}

/**
 * Get error message for regex validation failures
 */
function getRegexError(field: string, _issue: z.ZodIssue): string {
  // Check for specific field patterns
  if (field.toLowerCase().includes('duns')) {
    return ERROR_MESSAGES.invalidDuns()
  }
  if (field.toLowerCase().includes('cage')) {
    return ERROR_MESSAGES.invalidCage()
  }
  if (field.toLowerCase().includes('ein')) {
    return ERROR_MESSAGES.invalidEin()
  }
  if (field.toLowerCase().includes('naics')) {
    return ERROR_MESSAGES.invalidNaics()
  }
  if (field.toLowerCase().includes('zip')) {
    return ERROR_MESSAGES.invalidZip()
  }
  if (field.toLowerCase().includes('phone')) {
    return ERROR_MESSAGES.invalidPhone()
  }
  if (field.toLowerCase().includes('state')) {
    return ERROR_MESSAGES.invalidState()
  }
  
  return ERROR_MESSAGES.invalidFormat(field)
}

/**
 * Format validation errors for form display
 */
export function formatFormErrors(
  errors: z.ZodError | UserFriendlyError
): Record<string, string> {
  if ('errors' in errors) {
    // It's a ZodError
    const formatted = formatZodError(errors)
    const result: Record<string, string> = {}
    
    Object.entries(formatted.fields).forEach(([field, error]) => {
      result[field] = Array.isArray(error) ? error[0] : error
    })
    
    return result
  } else {
    // It's already a UserFriendlyError
    const result: Record<string, string> = {}
    
    Object.entries(errors.fields).forEach(([field, error]) => {
      result[field] = Array.isArray(error) ? error[0] : error
    })
    
    return result
  }
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  error: z.ZodError | Error,
  statusCode: number = 400
): Response {
  const body = error instanceof z.ZodError
    ? formatZodError(error)
    : {
        message: error.message || 'Validation failed',
        fields: {},
        summary: error.message
      }
  
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

/**
 * Helper to check if an error is a validation error
 */
export function isValidationError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError
}

/**
 * Extract field-specific errors from a formatted error
 */
export function getFieldErrors(
  formattedError: UserFriendlyError,
  field: string
): string[] {
  const error = formattedError.fields[field]
  if (!error) return []
  return Array.isArray(error) ? error : [error]
}

/**
 * Check if a specific field has errors
 */
export function hasFieldError(
  formattedError: UserFriendlyError,
  field: string
): boolean {
  return field in formattedError.fields
}