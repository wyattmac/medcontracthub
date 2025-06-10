/**
 * Database Security Module
 * 
 * Exports all security-related components for database operations
 * Provides centralized access to security features
 * 
 * Uses Context7-based patterns for Supabase security
 */

// Export RLS Policy Manager
export { RLSPolicyManager } from './rls-policies'
export type { RLSPolicy, PolicyValidationResult } from './rls-policies'

// Export Security Middleware
export { SecurityMiddleware } from './middleware'
export type { SecurityContext, SecurityConfig, SecurityEvent } from './middleware'

// Export Query Sanitization
export { QuerySanitizer, commonSchemas } from './sanitization'
export type { SanitizationResult } from './sanitization'

// Re-export commonly used functions for convenience
export { SecurityMiddleware as createSecurityMiddleware } from './middleware'

/**
 * Quick security check helper
 */
export async function checkDatabaseAccess(
  middleware: SecurityMiddleware,
  context: SecurityContext,
  resource: string,
  action: 'read' | 'write' | 'delete' | 'analyze' | 'export'
): Promise<boolean> {
  try {
    await middleware.validatePermission(context, resource, action)
    return true
  } catch {
    return false
  }
}

/**
 * Sanitize common query parameters
 */
export function sanitizeCommonParams(params: Record<string, unknown>) {
  return QuerySanitizer.sanitizeQueryParams(params, [
    'page',
    'pageSize',
    'sortBy',
    'sortOrder',
    'query',
    'filter',
    'startDate',
    'endDate',
    'status',
    'type',
    'id'
  ])
}