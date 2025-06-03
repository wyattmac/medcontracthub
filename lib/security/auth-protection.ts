import { createClient } from '@/lib/supabase/server'
import { authLogger } from '@/lib/errors/logger'
import { AuthenticationError } from '@/lib/errors/types'
import { addMinutes, isAfter } from 'date-fns'

// Rate limiting for auth attempts
const authAttempts = new Map<string, { count: number; resetAt: Date }>()

// Constants for auth security
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 15
const SESSION_TIMEOUT_MINUTES = 60
const SESSION_RENEWAL_THRESHOLD_MINUTES = 15

/**
 * Check if an email is locked out due to too many failed attempts
 */
export function isAccountLocked(email: string): boolean {
  const attempts = authAttempts.get(email)
  if (!attempts) return false
  
  if (isAfter(new Date(), attempts.resetAt)) {
    authAttempts.delete(email)
    return false
  }
  
  return attempts.count >= MAX_LOGIN_ATTEMPTS
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(email: string): void {
  const attempts = authAttempts.get(email) || {
    count: 0,
    resetAt: addMinutes(new Date(), LOCKOUT_DURATION_MINUTES)
  }
  
  attempts.count++
  authAttempts.set(email, attempts)
  
  authLogger.warn('Failed login attempt recorded', {
    email,
    attemptCount: attempts.count,
    maxAttempts: MAX_LOGIN_ATTEMPTS
  })
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    authLogger.error('Account locked due to too many failed attempts', {
      email,
      lockoutDuration: LOCKOUT_DURATION_MINUTES
    })
  }
}

/**
 * Clear failed attempts for an email (on successful login)
 */
export function clearFailedAttempts(email: string): void {
  authAttempts.delete(email)
}

/**
 * Validate session and check for timeout
 */
export async function validateSession(userId: string): Promise<boolean> {
  const supabase = await createClient()
  
  try {
    const { data: session, error } = await supabase.auth.getSession()
    
    if (error || !session?.session) {
      authLogger.warn('Invalid session', { userId, error })
      return false
    }
    
    // Check if session needs renewal
    const expiresAt = new Date(session.session.expires_at! * 1000)
    const renewalThreshold = addMinutes(new Date(), SESSION_RENEWAL_THRESHOLD_MINUTES)
    
    if (isAfter(renewalThreshold, expiresAt)) {
      authLogger.info('Session needs renewal', { userId })
      const { error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        authLogger.error('Failed to refresh session', { userId, error: refreshError })
        return false
      }
    }
    
    return true
  } catch (error) {
    authLogger.error('Session validation error', { userId, error })
    return false
  }
}

/**
 * Enhanced password validation
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  // Check for common patterns
  const commonPatterns = [
    /(.)\1{2,}/, // Repeated characters (3 or more)
    /^123|abc|qwerty/i, // Common sequences
    /password|admin|user|medical/i, // Common words
  ]
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains common patterns or words')
      break
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Generate secure session token
 */
export function generateSecureToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Sanitize email for safe logging
 */
export function sanitizeEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return 'invalid-email'
  
  const sanitizedLocal = local.substring(0, 2) + '***'
  return `${sanitizedLocal}@${domain}`
}