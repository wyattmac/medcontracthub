/**
 * Validation Module
 * Central export point for all validation functionality
 */

// Core schemas
export * from './shared-schemas'
export * from './business-rules'
export * from './computed-properties'
export {
  US_STATE_CODES,
  SET_ASIDE_TYPES,
  CONTRACT_TYPES,
  CERTIFICATION_TYPES,
  ALLOWED_FILE_TYPES,
  ALL_ALLOWED_FILE_TYPES,
  REGEX_PATTERNS,
  VALIDATION_LIMITS,
  // Omit ERROR_MESSAGES to avoid conflict with error-messages module
} from './constants'

// Validation services
export * from './services'

// Error handling
export { ERROR_MESSAGES } from './error-messages'
export * from './error-formatter'

// Convenience re-exports
export { z } from 'zod'