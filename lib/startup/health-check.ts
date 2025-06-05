/**
 * Production Startup Health Checks
 * Validates all critical services are configured and accessible
 */

import { getConnectionPool } from '@/lib/db/connection-pool'
import { checkRedisHealth, getRedisClient } from '@/lib/redis/client'
import { checkProductionReadiness, logProductionConfig } from '@/lib/config/production'
import { logger } from '@/lib/errors/logger'

export interface IHealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  message?: string
  latency?: number
}

export interface IStartupHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  results: IHealthCheckResult[]
  configuration: {
    ready: boolean
    issues: string[]
  }
}

/**
 * Run comprehensive startup health checks
 */
export async function runStartupHealthChecks(): Promise<IStartupHealthCheck> {
  const results: IHealthCheckResult[] = []
  const startTime = Date.now()
  
  logger.info('Starting production health checks...')
  
  // 1. Check production configuration
  const configCheck = checkProductionReadiness()
  if (!configCheck.ready) {
    logger.warn('Production configuration issues found', { issues: configCheck.issues })
  }
  
  // 2. Check Redis connectivity
  const redisStart = Date.now()
  try {
    const redisHealthy = await checkRedisHealth()
    results.push({
      service: 'Redis',
      status: redisHealthy ? 'healthy' : 'unhealthy',
      message: redisHealthy ? 'Redis connection successful' : 'Redis connection failed',
      latency: Date.now() - redisStart
    })
    
    if (redisHealthy) {
      // Test Redis operations
      const client = getRedisClient()
      await client.set('health:check', Date.now().toString(), 'EX', 60)
      const value = await client.get('health:check')
      if (!value) {
        throw new Error('Redis read/write test failed')
      }
    }
  } catch (error) {
    logger.error('Redis health check failed', error as Error)
    results.push({
      service: 'Redis',
      status: 'unhealthy',
      message: `Redis error: ${(error as Error).message}`,
      latency: Date.now() - redisStart
    })
  }
  
  // 3. Check database connection pool
  const dbStart = Date.now()
  try {
    const pool = getConnectionPool()
    await pool.withConnection(async (client) => {
      const { error } = await client
        .from('opportunities')
        .select('count')
        .limit(1)
        .single()
      
      if (error) throw error
      return true
    })
    
    const poolStats = pool.getStats()
    
    results.push({
      service: 'Database',
      status: 'healthy',
      message: `Connection pool active (${poolStats.inUse}/${poolStats.total} connections)`,
      latency: Date.now() - dbStart
    })
  } catch (error) {
    logger.error('Database health check failed', error as Error)
    results.push({
      service: 'Database',
      status: 'unhealthy',
      message: `Database error: ${(error as Error).message}`,
      latency: Date.now() - dbStart
    })
  }
  
  // 4. Check Supabase Auth
  const authStart = Date.now()
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing')
    }
    
    // Just check configuration exists
    results.push({
      service: 'Supabase Auth',
      status: 'healthy',
      message: 'Supabase configuration validated',
      latency: Date.now() - authStart
    })
  } catch (error) {
    results.push({
      service: 'Supabase Auth',
      status: 'unhealthy',
      message: `Auth configuration error: ${(error as Error).message}`,
      latency: Date.now() - authStart
    })
  }
  
  // 5. Check external APIs configuration
  const apiResults: IHealthCheckResult[] = [
    {
      service: 'SAM.gov API',
      status: process.env.SAM_GOV_API_KEY ? 'healthy' : 'unhealthy',
      message: process.env.SAM_GOV_API_KEY ? 'API key configured' : 'API key missing'
    },
    {
      service: 'Anthropic API',
      status: process.env.ANTHROPIC_API_KEY ? 'healthy' : 'unhealthy',
      message: process.env.ANTHROPIC_API_KEY ? 'API key configured' : 'API key missing'
    },
    {
      service: 'Resend Email',
      status: process.env.RESEND_API_KEY ? 'healthy' : 'unhealthy',
      message: process.env.RESEND_API_KEY ? 'API key configured' : 'API key missing'
    },
    {
      service: 'Stripe',
      status: process.env.STRIPE_SECRET_KEY ? 'healthy' : 'degraded',
      message: process.env.STRIPE_SECRET_KEY ? 'API key configured' : 'API key missing (billing disabled)'
    }
  ]
  
  results.push(...apiResults)
  
  // Determine overall status
  const unhealthyCount = results.filter(r => r.status === 'unhealthy').length
  const degradedCount = results.filter(r => r.status === 'degraded').length
  
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
  if (unhealthyCount > 0) {
    overallStatus = 'unhealthy'
  } else if (degradedCount > 0 || !configCheck.ready) {
    overallStatus = 'degraded'
  }
  
  const healthCheck: IStartupHealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    results,
    configuration: configCheck
  }
  
  // Log results
  logger.info('Health check completed', {
    status: overallStatus,
    duration: Date.now() - startTime,
    services: results.length,
    healthy: results.filter(r => r.status === 'healthy').length,
    unhealthy: unhealthyCount,
    degraded: degradedCount
  })
  
  // Log production configuration (sanitized)
  if (process.env.NODE_ENV === 'production') {
    logProductionConfig()
  }
  
  return healthCheck
}

/**
 * Express/Next.js health check endpoint handler
 */
export async function healthCheckHandler(): Promise<{
  status: number
  body: IStartupHealthCheck
}> {
  const healthCheck = await runStartupHealthChecks()
  
  let statusCode = 200
  if (healthCheck.status === 'unhealthy') {
    statusCode = 503
  } else if (healthCheck.status === 'degraded') {
    statusCode = 200 // Still return 200 for degraded to not trigger alarms
  }
  
  return {
    status: statusCode,
    body: healthCheck
  }
}

/**
 * Run startup checks and exit if critical services fail
 */
export async function validateProductionStartup(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Skipping production startup validation in development')
    return
  }
  
  const healthCheck = await runStartupHealthChecks()
  
  // Check for critical failures
  const criticalServices = ['Redis', 'Database', 'Supabase Auth']
  const criticalFailures = healthCheck.results.filter(
    r => criticalServices.includes(r.service) && r.status === 'unhealthy'
  )
  
  if (criticalFailures.length > 0) {
    logger.error('Critical services failed startup health check', {
      failures: criticalFailures
    })
    
    // In production, exit to prevent serving requests
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  }
  
  if (healthCheck.configuration.issues.length > 0) {
    logger.warn('Production configuration issues detected', {
      issues: healthCheck.configuration.issues
    })
  }
  
  logger.info('Production startup validation completed successfully')
}