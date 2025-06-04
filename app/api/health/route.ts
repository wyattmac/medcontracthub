/**
 * API Route: Health check endpoint
 * GET /api/health
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/errors/logger'
import { formatErrorResponse } from '@/lib/errors/utils'
import { runStartupHealthChecks } from '@/lib/startup/health-check'
import { checkRedisHealth } from '@/lib/redis/client'
import { getConnectionPool } from '@/lib/db/connection-pool'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestId = `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    apiLogger.info('Health check started', { requestId })
    
    // Check for detailed health check request
    const isDetailed = request.nextUrl.searchParams.get('detailed') === 'true'
    
    // For detailed checks, run comprehensive health checks
    if (isDetailed) {
      const detailedHealth = await runStartupHealthChecks()
      
      return NextResponse.json({
        ...detailedHealth,
        requestId,
        responseTime: `${Date.now() - startTime}ms`
      }, {
        status: detailedHealth.status === 'healthy' ? 200 : 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Request-Id': requestId
        }
      })
    }
    
    // Initialize checks object for basic health check
    const checks = {
      database: 'unknown',
      redis: 'unknown',
      connectionPool: 'unknown',
      environment: {
        supabase: false,
        samApi: false,
        claudeApi: false,
        resend: false
      },
      externalServices: {
        samGov: 'unknown',
        anthropic: 'unknown'
      }
    }

    // Check environment variables
    checks.environment = {
      supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && 
                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && 
                   process.env.SUPABASE_SERVICE_ROLE_KEY),
      samApi: !!process.env.SAM_GOV_API_KEY,
      claudeApi: !!process.env.ANTHROPIC_API_KEY,
      resend: !!process.env.RESEND_API_KEY
    }

    // Check database connectivity with timeout
    try {
      const supabase = createServiceClient()
      
      const dbCheck = await Promise.race([
        supabase.from('profiles').select('count').limit(1).maybeSingle(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 5000)
        )
      ]) as any

      checks.database = dbCheck?.error ? 'error' : 'healthy'
      
      if (dbCheck?.error) {
        apiLogger.warn('Database health check failed', { 
          error: dbCheck.error,
          requestId 
        })
      }
    } catch (dbError) {
      checks.database = 'error'
      apiLogger.error('Database health check error', dbError, { requestId })
    }
    
    // Check Redis connectivity
    try {
      const redisHealthy = await checkRedisHealth()
      checks.redis = redisHealthy ? 'healthy' : 'error'
    } catch (redisError) {
      checks.redis = 'error'
      apiLogger.warn('Redis health check failed', { error: redisError, requestId })
    }
    
    // Check connection pool stats
    try {
      const pool = getConnectionPool()
      const poolStats = pool.getStats()
      checks.connectionPool = poolStats.total > 0 ? 'healthy' : 'error'
    } catch (poolError) {
      checks.connectionPool = 'error'
      apiLogger.warn('Connection pool check failed', { error: poolError, requestId })
    }

    // Calculate overall health status
    const isHealthy = checks.database === 'healthy' && 
                     checks.redis === 'healthy' &&
                     checks.connectionPool === 'healthy' &&
                     Object.values(checks.environment).some(v => v === true)
    
    const responseTime = Date.now() - startTime
    
    const response = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: checks,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      requestId
    }

    apiLogger.info('Health check completed', {
      requestId,
      status: response.status,
      responseTime
    })

    // Handle test environment
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return new Response(JSON.stringify(response), {
        status: isHealthy ? 200 : 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Request-Id': requestId
        }
      }) as any
    }
    
    return NextResponse.json(response, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Request-Id': requestId
      }
    })

  } catch (error) {
    apiLogger.error('Health check failed', error, { requestId })
    return formatErrorResponse(error, requestId)
  }
}