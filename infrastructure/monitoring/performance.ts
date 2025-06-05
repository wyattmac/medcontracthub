/**
 * Performance Monitoring
 * Track and optimize application performance
 */

import { logger } from './logger'

interface IPerformanceMetric {
  name: string
  duration: number
  success: boolean
  error?: any
  metadata?: Record<string, any>
}

export class PerformanceMonitor {
  private static metrics: IPerformanceMetric[] = []
  private static batchTimer: NodeJS.Timeout | null = null

  /**
   * Track performance of an async operation
   */
  static async track<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = performance.now()
    
    try {
      const result = await fn()
      const duration = performance.now() - start
      
      this.recordMetric({
        name,
        duration,
        success: true,
        metadata
      })
      
      // Log slow operations
      if (duration > 1000) {
        logger.warn(`Slow operation detected: ${name}`, {
          duration,
          metadata
        })
      }
      
      return result
    } catch (error) {
      const duration = performance.now() - start
      
      this.recordMetric({
        name,
        duration,
        success: false,
        error,
        metadata
      })
      
      throw error
    }
  }

  /**
   * Track sync operation
   */
  static trackSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const start = performance.now()
    
    try {
      const result = fn()
      const duration = performance.now() - start
      
      this.recordMetric({
        name,
        duration,
        success: true,
        metadata
      })
      
      return result
    } catch (error) {
      const duration = performance.now() - start
      
      this.recordMetric({
        name,
        duration,
        success: false,
        error,
        metadata
      })
      
      throw error
    }
  }

  /**
   * Create a performance timer
   */
  static startTimer(name: string, metadata?: Record<string, any>) {
    const start = performance.now()
    
    return {
      end: (success: boolean = true, error?: any) => {
        const duration = performance.now() - start
        
        this.recordMetric({
          name,
          duration,
          success,
          error,
          metadata
        })
      }
    }
  }

  /**
   * Record a metric
   */
  private static recordMetric(metric: IPerformanceMetric) {
    this.metrics.push(metric)
    
    // Batch send metrics every 10 seconds
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.sendMetrics()
        this.batchTimer = null
      }, 10000)
    }
    
    // Send immediately if we have too many metrics
    if (this.metrics.length >= 100) {
      this.sendMetrics()
    }
  }

  /**
   * Send metrics to monitoring service
   */
  private static async sendMetrics() {
    if (this.metrics.length === 0) return
    
    const metricsToSend = [...this.metrics]
    this.metrics = []
    
    try {
      // In production, send to monitoring service
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/monitoring/metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metrics: metricsToSend,
            timestamp: new Date().toISOString()
          })
        })
      }
      
      // Always log summary in development
      if (process.env.NODE_ENV === 'development') {
        const summary = this.summarizeMetrics(metricsToSend)
        logger.debug('Performance metrics summary', summary)
      }
    } catch (error) {
      logger.error('Failed to send performance metrics', { error })
    }
  }

  /**
   * Summarize metrics for logging
   */
  private static summarizeMetrics(metrics: IPerformanceMetric[]) {
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = {
          count: 0,
          totalDuration: 0,
          maxDuration: 0,
          minDuration: Infinity,
          failures: 0
        }
      }
      
      const group = acc[metric.name]
      group.count++
      group.totalDuration += metric.duration
      group.maxDuration = Math.max(group.maxDuration, metric.duration)
      group.minDuration = Math.min(group.minDuration, metric.duration)
      
      if (!metric.success) {
        group.failures++
      }
      
      return acc
    }, {} as Record<string, any>)
    
    // Calculate averages and format
    return Object.entries(grouped).map(([name, stats]: [string, any]) => ({
      name,
      count: stats.count,
      avgDuration: Math.round(stats.totalDuration / stats.count),
      maxDuration: Math.round(stats.maxDuration),
      minDuration: Math.round(stats.minDuration),
      failureRate: (stats.failures / stats.count * 100).toFixed(2) + '%'
    }))
  }

  /**
   * Get current metrics (for debugging)
   */
  static getMetrics() {
    return [...this.metrics]
  }

  /**
   * Clear all metrics
   */
  static clear() {
    this.metrics = []
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }
}

/**
 * Express middleware for tracking route performance
 */
export function performanceMiddleware(req: any, res: any, next: any) {
  const timer = PerformanceMonitor.startTimer(`route:${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent']
  })
  
  // Track response
  const originalEnd = res.end
  res.end = function(...args: any[]) {
    timer.end(res.statusCode < 400)
    originalEnd.apply(res, args)
  }
  
  next()
}

/**
 * React Query performance observer
 */
export function createQueryPerformanceObserver() {
  return {
    onSuccess: (data: any, query: any) => {
      const duration = query.state.dataUpdatedAt - query.state.fetchedAt
      
      PerformanceMonitor.recordMetric({
        name: `query:${query.queryKey.join(':')}`,
        duration,
        success: true,
        metadata: {
          queryKey: query.queryKey,
          dataSize: JSON.stringify(data).length
        }
      })
    },
    onError: (error: any, query: any) => {
      const duration = Date.now() - query.state.fetchedAt
      
      PerformanceMonitor.recordMetric({
        name: `query:${query.queryKey.join(':')}`,
        duration,
        success: false,
        error,
        metadata: {
          queryKey: query.queryKey
        }
      })
    }
  }
}