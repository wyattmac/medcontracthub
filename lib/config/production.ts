/**
 * Production Configuration
 * Centralized configuration for production environment settings
 */

import { validateEnvironment } from '@/lib/security/env-validator'

export interface IProductionConfig {
  // Redis Configuration
  redis: {
    url?: string
    host: string
    port: number
    password?: string
    db: number
    maxRetries: number
    retryDelay: number
    enableOfflineQueue: boolean
  }
  
  // Database Connection Pool
  database: {
    maxConnections: number
    minConnections: number
    connectionTimeout: number
    idleTimeout: number
    statementTimeout: number
  }
  
  // Rate Limiting
  rateLimit: {
    enabled: boolean
    defaultWindow: number // in seconds
    defaultMaxRequests: number
  }
  
  // Caching
  cache: {
    enabled: boolean
    defaultTTL: number // in seconds
    opportunitiesTTL: number
    analysisTTL: number
  }
  
  // Queue Configuration
  queue: {
    defaultJobOptions: {
      attempts: number
      backoff: {
        type: 'exponential' | 'fixed'
        delay: number
      }
      removeOnComplete: boolean
      removeOnFail: boolean
    }
  }
  
  // Performance
  performance: {
    enableAPM: boolean
    slowQueryThreshold: number // in milliseconds
    requestTimeout: number // in seconds
  }
  
  // Security
  security: {
    corsOrigins: string[]
    trustedProxies: string[]
    maxRequestSize: string
  }
}

/**
 * Get production configuration
 * Validates and returns production settings
 */
export function getProductionConfig(): IProductionConfig {
  // Validate environment in production
  if (process.env.NODE_ENV === 'production') {
    validateEnvironment()
  }
  
  return {
    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '2000'),
      enableOfflineQueue: process.env.REDIS_ENABLE_OFFLINE_QUEUE !== 'false'
    },
    
    database: {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '25'),
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '60000'),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300000'),
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000')
    },
    
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      defaultWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900'), // 15 minutes
      defaultMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
    },
    
    cache: {
      enabled: process.env.CACHE_ENABLED !== 'false',
      defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '3600'), // 1 hour
      opportunitiesTTL: parseInt(process.env.CACHE_OPPORTUNITIES_TTL || '900'), // 15 minutes
      analysisTTL: parseInt(process.env.CACHE_ANALYSIS_TTL || '86400') // 24 hours
    },
    
    queue: {
      defaultJobOptions: {
        attempts: parseInt(process.env.QUEUE_JOB_ATTEMPTS || '3'),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '5000')
        },
        removeOnComplete: process.env.QUEUE_REMOVE_ON_COMPLETE !== 'false',
        removeOnFail: process.env.QUEUE_REMOVE_ON_FAIL === 'true'
      }
    },
    
    performance: {
      enableAPM: process.env.ENABLE_APM === 'true',
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30')
    },
    
    security: {
      corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
      trustedProxies: (process.env.TRUSTED_PROXIES || '').split(',').filter(Boolean),
      maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb'
    }
  }
}

/**
 * Production readiness checks
 */
export function checkProductionReadiness(): {
  ready: boolean
  issues: string[]
} {
  const issues: string[] = []
  
  // Check Redis
  if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
    issues.push('REDIS_URL not configured for production')
  }
  
  // Check database pooling
  const dbMaxConn = parseInt(process.env.DB_MAX_CONNECTIONS || '25')
  const dbMinConn = parseInt(process.env.DB_MIN_CONNECTIONS || '5')
  
  if (dbMinConn > dbMaxConn) {
    issues.push('DB_MIN_CONNECTIONS cannot be greater than DB_MAX_CONNECTIONS')
  }
  
  // Check Sentry
  if (!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
    issues.push('SENTRY_DSN not configured for error monitoring')
  }
  
  // Check CSRF
  if (!process.env.CSRF_SECRET && process.env.NODE_ENV === 'production') {
    issues.push('CSRF_SECRET not configured for CSRF protection')
  }
  
  // Check rate limiting
  if (process.env.RATE_LIMIT_ENABLED === 'false' && process.env.NODE_ENV === 'production') {
    issues.push('Rate limiting is disabled in production')
  }
  
  return {
    ready: issues.length === 0,
    issues
  }
}

/**
 * Log production configuration (sanitized)
 */
export function logProductionConfig(): void {
  const config = getProductionConfig()
  
  console.log('Production Configuration:', {
    redis: {
      configured: !!config.redis.url || !!config.redis.password,
      host: config.redis.host,
      port: config.redis.port,
      maxRetries: config.redis.maxRetries
    },
    database: {
      maxConnections: config.database.maxConnections,
      minConnections: config.database.minConnections,
      connectionTimeout: config.database.connectionTimeout
    },
    rateLimit: {
      enabled: config.rateLimit.enabled,
      window: config.rateLimit.defaultWindow,
      maxRequests: config.rateLimit.defaultMaxRequests
    },
    cache: {
      enabled: config.cache.enabled,
      defaultTTL: config.cache.defaultTTL
    },
    performance: {
      enableAPM: config.performance.enableAPM,
      slowQueryThreshold: config.performance.slowQueryThreshold,
      requestTimeout: config.performance.requestTimeout
    }
  })
}