/**
 * Security Monitoring and Alert System
 * Monitors security events and sends alerts for suspicious activity
 */

import { apiLogger } from '@/lib/errors/logger'
import { getRedisClient } from '@/lib/redis/client'

export interface SecurityEvent {
  type: SecurityEventType
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  details: Record<string, any>
  timestamp: Date
  userAgent?: string
  ip?: string
  userId?: string
}

export enum SecurityEventType {
  // Authentication events
  FAILED_LOGIN = 'failed_login',
  ACCOUNT_LOCKOUT = 'account_lockout',
  SUSPICIOUS_LOGIN = 'suspicious_login',
  PASSWORD_RESET_ABUSE = 'password_reset_abuse',
  
  // Rate limiting events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  BULK_REQUESTS = 'bulk_requests',
  
  // File upload events
  MALICIOUS_FILE_UPLOAD = 'malicious_file_upload',
  SUSPICIOUS_FILE_TYPE = 'suspicious_file_type',
  OVERSIZED_UPLOAD = 'oversized_upload',
  
  // API abuse events
  INVALID_API_CALLS = 'invalid_api_calls',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  
  // System events
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  CONFIGURATION_CHANGE = 'configuration_change',
  CRITICAL_ERROR = 'critical_error',
  
  // Data access events
  BULK_DATA_ACCESS = 'bulk_data_access',
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  DATA_EXPORT_ABUSE = 'data_export_abuse'
}

class SecurityMonitor {
  private alertThresholds = {
    [SecurityEventType.FAILED_LOGIN]: { count: 5, window: 15 * 60 * 1000 }, // 5 in 15 min
    [SecurityEventType.RATE_LIMIT_EXCEEDED]: { count: 3, window: 5 * 60 * 1000 }, // 3 in 5 min
    [SecurityEventType.MALICIOUS_FILE_UPLOAD]: { count: 1, window: 60 * 1000 }, // 1 in 1 min
    [SecurityEventType.SQL_INJECTION_ATTEMPT]: { count: 1, window: 60 * 1000 }, // Immediate
    [SecurityEventType.XSS_ATTEMPT]: { count: 1, window: 60 * 1000 }, // Immediate
    [SecurityEventType.PRIVILEGE_ESCALATION]: { count: 1, window: 60 * 1000 }, // Immediate
  }

  /**
   * Log a security event and check for alert conditions
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Always log the event
      apiLogger.warn('Security event detected', {
        type: event.type,
        severity: event.severity,
        source: event.source,
        details: event.details,
        ip: event.ip,
        userId: event.userId,
        userAgent: event.userAgent
      })

      // Store in Redis for pattern analysis
      await this.storeEventInRedis(event)

      // Check if this event should trigger an alert
      const shouldAlert = await this.checkAlertThreshold(event)
      
      if (shouldAlert) {
        await this.sendSecurityAlert(event)
      }

      // Check for complex attack patterns
      await this.analyzeAttackPatterns(event)

    } catch (error) {
      apiLogger.error('Failed to log security event', error)
    }
  }

  /**
   * Store security event in Redis for analysis
   */
  private async storeEventInRedis(event: SecurityEvent): Promise<void> {
    const redisClient = getRedisClient()
    if (!redisClient || !redisClient.isReady) return

    const key = `security:events:${event.type}`
    const eventData = {
      ...event,
      timestamp: event.timestamp.toISOString()
    }

    // Store with 24 hour expiration
    await redisClient.lpush(key, JSON.stringify(eventData))
    await redisClient.expire(key, 24 * 60 * 60)
    
    // Keep only last 1000 events per type
    await redisClient.ltrim(key, 0, 999)
  }

  /**
   * Check if event should trigger an alert based on frequency
   */
  private async checkAlertThreshold(event: SecurityEvent): Promise<boolean> {
    const threshold = this.alertThresholds[event.type]
    if (!threshold) return false

    const redisClient = getRedisClient()
    if (!redisClient || !redisClient.isReady) {
      // If Redis is not available, alert on critical events
      return event.severity === 'critical'
    }

    const key = `security:events:${event.type}`
    const events = await redisClient.lrange(key, 0, -1)
    
    const recentEvents = events
      .map(e => JSON.parse(e))
      .filter(e => {
        const eventTime = new Date(e.timestamp).getTime()
        return Date.now() - eventTime < threshold.window
      })

    return recentEvents.length >= threshold.count
  }

  /**
   * Send security alert (placeholder for notification system)
   */
  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    // Log critical alert
    apiLogger.error('SECURITY ALERT TRIGGERED', {
      type: event.type,
      severity: event.severity,
      details: event.details,
      timestamp: event.timestamp.toISOString()
    })

    // TODO: Integrate with notification service (email, Slack, PagerDuty)
    // For now, just ensure it's captured in logs and Sentry
    
    // In production, you would integrate with:
    // - Email notifications for critical events
    // - Slack/Discord webhooks for team alerts
    // - PagerDuty for incident response
    // - SMS alerts for security team
  }

  /**
   * Analyze patterns to detect sophisticated attacks
   */
  private async analyzeAttackPatterns(event: SecurityEvent): Promise<void> {
    if (!redisClient || !redisClient.isReady) return

    try {
      // Check for coordinated attacks from multiple IPs
      if (event.ip) {
        await this.checkCoordinatedAttack(event)
      }

      // Check for escalating attack patterns
      await this.checkEscalatingAttacks(event)

      // Check for suspicious user behavior
      if (event.userId) {
        await this.checkSuspiciousUserBehavior(event)
      }

    } catch (error) {
      apiLogger.error('Failed to analyze attack patterns', error)
    }
  }

  /**
   * Check for coordinated attacks from multiple sources
   */
  private async checkCoordinatedAttack(event: SecurityEvent): Promise<void> {
    const key = 'security:ips:recent'
    const now = Date.now()
    
    // Track IPs with recent security events
    await redisClient.zadd(key, now, event.ip!)
    await redisClient.expire(key, 60 * 60) // 1 hour
    
    // Remove old entries (older than 10 minutes)
    await redisClient.zremrangebyscore(key, 0, now - 10 * 60 * 1000)
    
    // Check if multiple IPs are attacking
    const recentIPs = await redisClient.zcard(key)
    
    if (recentIPs >= 5) { // 5 or more IPs in 10 minutes
      await this.logSecurityEvent({
        type: SecurityEventType.BULK_REQUESTS,
        severity: 'high',
        source: 'security_monitor',
        details: {
          reason: 'Coordinated attack detected',
          uniqueIPs: recentIPs,
          timeWindow: '10 minutes'
        },
        timestamp: new Date()
      })
    }
  }

  /**
   * Check for escalating attack patterns
   */
  private async checkEscalatingAttacks(event: SecurityEvent): Promise<void> {
    const key = `security:escalation:${event.source}`
    
    // Track severity escalation
    await redisClient.lpush(key, event.severity)
    await redisClient.expire(key, 30 * 60) // 30 minutes
    await redisClient.ltrim(key, 0, 9) // Keep last 10 events
    
    const recentEvents = await redisClient.lrange(key, 0, -1)
    
    // Check for escalating severity
    const hasEscalation = recentEvents.length >= 3 && 
      recentEvents.includes('critical') &&
      recentEvents.includes('high') &&
      recentEvents.includes('medium')
    
    if (hasEscalation) {
      await this.logSecurityEvent({
        type: SecurityEventType.CRITICAL_ERROR,
        severity: 'critical',
        source: 'security_monitor',
        details: {
          reason: 'Attack escalation detected',
          originalSource: event.source,
          pattern: recentEvents
        },
        timestamp: new Date()
      })
    }
  }

  /**
   * Check for suspicious user behavior patterns
   */
  private async checkSuspiciousUserBehavior(event: SecurityEvent): Promise<void> {
    const key = `security:user:${event.userId}`
    const now = Date.now()
    
    // Track user security events
    await redisClient.zadd(key, now, event.type)
    await redisClient.expire(key, 60 * 60) // 1 hour
    
    // Check for multiple security events from same user
    const userEvents = await redisClient.zcard(key)
    
    if (userEvents >= 3) { // 3 or more security events in 1 hour
      await this.logSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_LOGIN,
        severity: 'high',
        source: 'security_monitor',
        details: {
          reason: 'Multiple security events from user',
          userId: event.userId,
          eventCount: userEvents,
          timeWindow: '1 hour'
        },
        timestamp: new Date()
      })
    }
  }

  /**
   * Get security event statistics
   */
  async getSecurityStats(hours: number = 24): Promise<any> {
    if (!redisClient || !redisClient.isReady) {
      return { error: 'Redis not available' }
    }

    const stats: any = {}
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)

    for (const eventType of Object.values(SecurityEventType)) {
      const key = `security:events:${eventType}`
      const events = await redisClient.lrange(key, 0, -1)
      
      const recentEvents = events
        .map(e => JSON.parse(e))
        .filter(e => new Date(e.timestamp).getTime() > cutoff)

      stats[eventType] = {
        total: recentEvents.length,
        bySeverity: {
          low: recentEvents.filter(e => e.severity === 'low').length,
          medium: recentEvents.filter(e => e.severity === 'medium').length,
          high: recentEvents.filter(e => e.severity === 'high').length,
          critical: recentEvents.filter(e => e.severity === 'critical').length,
        }
      }
    }

    return {
      timeWindow: `${hours} hours`,
      stats,
      generated: new Date().toISOString()
    }
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor()

// Convenience functions for common security events
export const logFailedLogin = (ip: string, userAgent?: string, userId?: string) => {
  return securityMonitor.logSecurityEvent({
    type: SecurityEventType.FAILED_LOGIN,
    severity: 'medium',
    source: 'authentication',
    details: { action: 'login_failed' },
    timestamp: new Date(),
    ip,
    userAgent,
    userId
  })
}

export const logRateLimitExceeded = (ip: string, endpoint: string, userAgent?: string) => {
  return securityMonitor.logSecurityEvent({
    type: SecurityEventType.RATE_LIMIT_EXCEEDED,
    severity: 'medium',
    source: 'rate_limiter',
    details: { endpoint, action: 'rate_limit_hit' },
    timestamp: new Date(),
    ip,
    userAgent
  })
}

export const logMaliciousFileUpload = (ip: string, filename: string, reason: string, userId?: string) => {
  return securityMonitor.logSecurityEvent({
    type: SecurityEventType.MALICIOUS_FILE_UPLOAD,
    severity: 'high',
    source: 'file_upload',
    details: { filename, reason, action: 'file_blocked' },
    timestamp: new Date(),
    ip,
    userId
  })
}

export const logSQLInjectionAttempt = (ip: string, query: string, endpoint: string) => {
  return securityMonitor.logSecurityEvent({
    type: SecurityEventType.SQL_INJECTION_ATTEMPT,
    severity: 'critical',
    source: 'sql_injection_detection',
    details: { 
      query: query.substring(0, 200), // Truncate for safety
      endpoint,
      action: 'injection_blocked'
    },
    timestamp: new Date(),
    ip
  })
}

export const logUnauthorizedAccess = (ip: string, resource: string, userId?: string) => {
  return securityMonitor.logSecurityEvent({
    type: SecurityEventType.UNAUTHORIZED_ACCESS,
    severity: 'high',
    source: 'authorization',
    details: { resource, action: 'access_denied' },
    timestamp: new Date(),
    ip,
    userId
  })
}