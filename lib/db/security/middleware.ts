/**
 * Security Middleware
 * 
 * Validates user permissions before database queries
 * Implements rate limiting and logs security events
 * 
 * Uses Context7-based patterns for Supabase security
 * Reference: /supabase/supabase - middleware patterns
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { RLSPolicyManager } from './rls-policies'
import { logger } from '@/lib/errors/logger'
import { AuthorizationError, RateLimitError } from '@/lib/errors/types'
import { startSpan } from '@/lib/monitoring/performance'
import { createHash } from 'crypto'

export interface SecurityContext {
  userId: string
  companyId?: string
  role?: 'owner' | 'admin' | 'member'
  sessionId?: string
  ipAddress?: string
}

export interface SecurityConfig {
  rateLimits: {
    reads: number // per minute
    writes: number // per minute
    analyses: number // per hour
    exports: number // per day
  }
  suspiciousPatterns: RegExp[]
  trustedDomains: string[]
}

export interface SecurityEvent {
  type: 'access_denied' | 'rate_limit' | 'suspicious_activity' | 'permission_check'
  userId: string
  resource: string
  action: string
  metadata?: Record<string, any>
  timestamp: Date
}

export class SecurityMiddleware {
  private static readonly defaultConfig: SecurityConfig = {
    rateLimits: {
      reads: 1000,  // per minute
      writes: 100,  // per minute
      analyses: 20, // per hour
      exports: 10   // per day
    },
    suspiciousPatterns: [
      /(\bDROP\b|\bDELETE\b.*\bFROM\b|\bTRUNCATE\b)/i,
      /(\bUNION\b.*\bSELECT\b)/i,
      /(\bEXEC\b|\bEXECUTE\b)/i,
      /(;|--|\*|xp_|sp_)/i
    ],
    trustedDomains: ['medcontracthub.com', 'localhost']
  }

  private rateLimitStore = new Map<string, { count: number; resetAt: Date }>()
  private securityEvents: SecurityEvent[] = []
  private readonly maxEvents = 1000

  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly config: SecurityConfig = SecurityMiddleware.defaultConfig
  ) {}

  /**
   * Validate user has permission for operation
   */
  async validatePermission(
    context: SecurityContext,
    resource: string,
    action: 'read' | 'write' | 'delete' | 'analyze' | 'export'
  ): Promise<void> {
    const span = startSpan('SecurityMiddleware.validatePermission')
    
    try {
      // Check if user is authenticated
      if (!context.userId) {
        this.logSecurityEvent({
          type: 'access_denied',
          userId: 'anonymous',
          resource,
          action,
          metadata: { reason: 'Not authenticated' }
        })
        throw new AuthorizationError('User not authenticated')
      }

      // Check rate limits
      await this.checkRateLimit(context, action)

      // Special permission checks based on resource and action
      const allowed = await this.checkSpecificPermissions(context, resource, action)
      
      if (!allowed) {
        this.logSecurityEvent({
          type: 'access_denied',
          userId: context.userId,
          resource,
          action,
          metadata: { 
            companyId: context.companyId,
            role: context.role 
          }
        })
        throw new AuthorizationError(`Insufficient permissions for ${action} on ${resource}`)
      }

      // Log successful permission check
      this.logSecurityEvent({
        type: 'permission_check',
        userId: context.userId,
        resource,
        action,
        metadata: { 
          success: true,
          companyId: context.companyId 
        }
      })

      span?.setStatus('ok')
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Check specific permissions based on resource and action
   */
  private async checkSpecificPermissions(
    context: SecurityContext,
    resource: string,
    action: string
  ): Promise<boolean> {
    // Company-level resources
    if (resource.startsWith('company:')) {
      if (!context.companyId) return false
      
      if (action === 'write' || action === 'delete') {
        return context.role === 'owner' || context.role === 'admin'
      }
      return true
    }

    // User-specific resources
    if (resource.startsWith('user:')) {
      const resourceUserId = resource.split(':')[1]
      return resourceUserId === context.userId
    }

    // Proposal resources
    if (resource.startsWith('proposal:')) {
      if (!context.companyId) return false
      
      if (action === 'delete') {
        // Additional check: only draft proposals can be deleted
        const proposalId = resource.split(':')[1]
        const { data } = await this.supabase
          .from('proposals')
          .select('status, user_id')
          .eq('id', proposalId)
          .single()
        
        return data?.status === 'draft' && data?.user_id === context.userId
      }
      return true
    }

    // Subscription resources
    if (resource.startsWith('subscription:')) {
      if (action === 'write') {
        return false // Only service role can modify subscriptions
      }
      return context.role === 'owner' || context.role === 'admin'
    }

    // Default to RLS policy check
    const rlsManager = new RLSPolicyManager(this.supabase)
    const table = resource.split(':')[0]
    const operation = this.mapActionToOperation(action)
    
    return rlsManager.testAccess(
      context.userId,
      table,
      operation,
      resource.split(':')[1]
    )
  }

  /**
   * Check rate limits
   */
  private async checkRateLimit(
    context: SecurityContext,
    action: string
  ): Promise<void> {
    const key = `${context.userId}:${action}`
    const now = new Date()
    
    // Get rate limit based on action
    let limit: number
    let window: number // in milliseconds
    
    switch (action) {
      case 'read':
        limit = this.config.rateLimits.reads
        window = 60 * 1000 // 1 minute
        break
      case 'write':
        limit = this.config.rateLimits.writes
        window = 60 * 1000 // 1 minute
        break
      case 'analyze':
        limit = this.config.rateLimits.analyses
        window = 60 * 60 * 1000 // 1 hour
        break
      case 'export':
        limit = this.config.rateLimits.exports
        window = 24 * 60 * 60 * 1000 // 1 day
        break
      default:
        return // No rate limit for other actions
    }

    // Check current rate
    const current = this.rateLimitStore.get(key)
    
    if (!current || current.resetAt < now) {
      // Create new window
      this.rateLimitStore.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + window)
      })
      return
    }

    // Increment count
    current.count++
    
    if (current.count > limit) {
      this.logSecurityEvent({
        type: 'rate_limit',
        userId: context.userId,
        resource: action,
        action: 'exceeded',
        metadata: { 
          limit,
          count: current.count,
          resetAt: current.resetAt
        }
      })
      
      throw new RateLimitError(
        `Rate limit exceeded for ${action}. Try again at ${current.resetAt.toISOString()}`
      )
    }
    
    this.rateLimitStore.set(key, current)
  }

  /**
   * Detect suspicious activity
   */
  detectSuspiciousActivity(
    context: SecurityContext,
    query: string | Record<string, any>
  ): void {
    const queryStr = typeof query === 'string' ? query : JSON.stringify(query)
    
    // Check for suspicious patterns
    for (const pattern of this.config.suspiciousPatterns) {
      if (pattern.test(queryStr)) {
        this.logSecurityEvent({
          type: 'suspicious_activity',
          userId: context.userId,
          resource: 'query',
          action: 'detected',
          metadata: {
            pattern: pattern.source,
            query: queryStr.substring(0, 200) // Truncate for security
          }
        })
        
        logger.warn('Suspicious activity detected', {
          userId: context.userId,
          pattern: pattern.source
        })
        
        // Don't throw here - just log and monitor
        break
      }
    }
  }

  /**
   * Log security event
   */
  private logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    }
    
    // Add to in-memory store
    this.securityEvents.push(fullEvent)
    
    // Keep only recent events
    if (this.securityEvents.length > this.maxEvents) {
      this.securityEvents = this.securityEvents.slice(-this.maxEvents)
    }
    
    // Log to monitoring system
    logger.info('Security event', fullEvent)
    
    // For critical events, also store in database
    if (event.type === 'access_denied' || event.type === 'suspicious_activity') {
      this.persistSecurityEvent(fullEvent).catch(err => {
        logger.error('Failed to persist security event', err)
      })
    }
  }

  /**
   * Persist critical security events to database
   */
  private async persistSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await this.supabase
        .from('security_events')
        .insert({
          type: event.type,
          user_id: event.userId,
          resource: event.resource,
          action: event.action,
          metadata: event.metadata,
          created_at: event.timestamp.toISOString()
        })
    } catch (error) {
      // Don't throw - this is a best-effort operation
      logger.error('Failed to persist security event', error)
    }
  }

  /**
   * Get security events for analysis
   */
  getSecurityEvents(
    filters?: {
      userId?: string
      type?: SecurityEvent['type']
      since?: Date
    }
  ): SecurityEvent[] {
    let events = [...this.securityEvents]
    
    if (filters?.userId) {
      events = events.filter(e => e.userId === filters.userId)
    }
    
    if (filters?.type) {
      events = events.filter(e => e.type === filters.type)
    }
    
    if (filters?.since) {
      events = events.filter(e => e.timestamp >= filters.since)
    }
    
    return events
  }

  /**
   * Generate security report
   */
  generateSecurityReport(): {
    totalEvents: number
    byType: Record<string, number>
    topUsers: Array<{ userId: string; count: number }>
    recentSuspicious: SecurityEvent[]
  } {
    const byType: Record<string, number> = {}
    const byUser: Record<string, number> = {}
    
    for (const event of this.securityEvents) {
      byType[event.type] = (byType[event.type] || 0) + 1
      byUser[event.userId] = (byUser[event.userId] || 0) + 1
    }
    
    const topUsers = Object.entries(byUser)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }))
    
    const recentSuspicious = this.securityEvents
      .filter(e => e.type === 'suspicious_activity')
      .slice(-10)
    
    return {
      totalEvents: this.securityEvents.length,
      byType,
      topUsers,
      recentSuspicious
    }
  }

  /**
   * Clear rate limits for a user (e.g., after subscription upgrade)
   */
  clearRateLimits(userId: string): void {
    const keysToRemove: string[] = []
    
    for (const [key] of this.rateLimitStore) {
      if (key.startsWith(`${userId}:`)) {
        keysToRemove.push(key)
      }
    }
    
    for (const key of keysToRemove) {
      this.rateLimitStore.delete(key)
    }
    
    logger.info('Rate limits cleared', { userId })
  }

  /**
   * Map action to RLS operation
   */
  private mapActionToOperation(action: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' {
    switch (action) {
      case 'read':
      case 'analyze':
      case 'export':
        return 'SELECT'
      case 'write':
        return 'INSERT'
      case 'delete':
        return 'DELETE'
      default:
        return 'SELECT'
    }
  }

  /**
   * Create security context from request
   */
  static async createContext(
    supabase: SupabaseClient<Database>,
    sessionId?: string,
    ipAddress?: string
  ): Promise<SecurityContext | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return null
      
      // Get user profile with company info
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .single()
      
      return {
        userId: user.id,
        companyId: profile?.company_id || undefined,
        role: profile?.role || undefined,
        sessionId,
        ipAddress
      }
    } catch (error) {
      logger.error('Failed to create security context', error)
      return null
    }
  }
}

// Export types
export type { SecurityContext, SecurityConfig, SecurityEvent }