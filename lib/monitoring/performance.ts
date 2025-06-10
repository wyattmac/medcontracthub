/**
 * Performance Monitoring Utilities
 * 
 * Provides performance tracking and monitoring capabilities
 * for database operations and other critical paths
 */

export interface Span {
  setStatus(status: 'ok' | 'error'): void
  finish(): void
}

/**
 * Creates a new performance monitoring span
 * Used to track the duration and status of operations
 */
export function startSpan(name: string, attributes?: Record<string, any>): Span {
  const startTime = Date.now()
  
  return {
    setStatus(status: 'ok' | 'error') {
      // In production, this would send to monitoring service
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[Performance] ${name} - Status: ${status}`)
      }
    },
    
    finish() {
      const duration = Date.now() - startTime
      
      // In production, this would send metrics
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[Performance] ${name} - Duration: ${duration}ms`)
      }
    }
  }
}

/**
 * Measure the duration of an async operation
 */
export async function measureAsync<T>(
  name: string, 
  operation: () => Promise<T>
): Promise<T> {
  const span = startSpan(name)
  
  try {
    const result = await operation()
    span.setStatus('ok')
    return result
  } catch (error) {
    span.setStatus('error')
    throw error
  } finally {
    span.finish()
  }
}

/**
 * Measure the duration of a sync operation
 */
export function measureSync<T>(
  name: string, 
  operation: () => T
): T {
  const span = startSpan(name)
  
  try {
    const result = operation()
    span.setStatus('ok')
    return result
  } catch (error) {
    span.setStatus('error')
    throw error
  } finally {
    span.finish()
  }
}

/**
 * Performance metrics collector
 */
export class PerformanceMetrics {
  private static metrics: Map<string, number[]> = new Map()
  
  static record(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    const values = this.metrics.get(name)!
    values.push(duration)
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift()
    }
  }
  
  static getStats(name: string) {
    const values = this.metrics.get(name) || []
    
    if (values.length === 0) {
      return null
    }
    
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length
    const sorted = [...values].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]
    
    return {
      count: values.length,
      avg: Math.round(avg),
      p50,
      p95,
      p99,
      min: sorted[0],
      max: sorted[sorted.length - 1]
    }
  }
  
  static clear() {
    this.metrics.clear()
  }
}