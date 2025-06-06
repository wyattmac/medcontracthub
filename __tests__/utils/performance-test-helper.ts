/**
 * Performance Testing Helper Utilities
 * Provides infrastructure for API performance testing and regression detection
 */

import { NextRequest } from 'next/server'
import { createMockRequest } from './api-test-helper'

export interface PerformanceMetrics {
  responseTime: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
  }
  requestsPerSecond?: number
  errorRate?: number
  p95ResponseTime?: number
  p99ResponseTime?: number
}

export interface PerformanceThresholds {
  maxResponseTime: number
  maxMemoryUsage: number
  minRequestsPerSecond?: number
  maxErrorRate?: number
  maxP95ResponseTime?: number
}

export interface LoadTestConfig {
  concurrency: number
  duration: number // in seconds
  rampUpTime?: number // in seconds
  targetRPS?: number
}

/**
 * Measures performance of a single API request
 */
export async function measureApiPerformance(
  apiHandler: (req: NextRequest) => Promise<Response>,
  request: NextRequest
): Promise<PerformanceMetrics> {
  const startTime = process.hrtime.bigint()
  const startMemory = process.memoryUsage()
  
  let response: Response
  let error: Error | null = null
  
  try {
    response = await apiHandler(request)
  } catch (e) {
    error = e as Error
    throw e
  } finally {
    const endTime = process.hrtime.bigint()
    const endMemory = process.memoryUsage()
    
    const responseTime = Number(endTime - startTime) / 1000000 // Convert to milliseconds
    
    return {
      responseTime,
      memoryUsage: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external
      }
    }
  }
}

/**
 * Runs a load test against an API endpoint
 */
export async function runLoadTest(
  apiHandler: (req: NextRequest) => Promise<Response>,
  url: string,
  config: LoadTestConfig,
  requestOptions?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: any
    headers?: Record<string, string>
  }
): Promise<PerformanceMetrics> {
  const { concurrency, duration, rampUpTime = 0 } = config
  const method = requestOptions?.method || 'GET'
  
  const results: number[] = []
  const errors: Error[] = []
  let startTime: number
  let endTime: number
  
  // Create worker function
  const worker = async (delay: number = 0) => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    const testStartTime = Date.now()
    while (Date.now() - testStartTime < duration * 1000) {
      const request = createMockRequest(method, url, requestOptions?.body, requestOptions?.headers)
      
      try {
        const metrics = await measureApiPerformance(apiHandler, request)
        results.push(metrics.responseTime)
      } catch (error) {
        errors.push(error as Error)
      }
      
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  
  // Start workers with ramp-up
  startTime = Date.now()
  const workers = []
  
  for (let i = 0; i < concurrency; i++) {
    const delay = rampUpTime > 0 ? (i * rampUpTime * 1000) / concurrency : 0
    workers.push(worker(delay))
  }
  
  await Promise.all(workers)
  endTime = Date.now()
  
  // Calculate metrics
  const totalRequests = results.length + errors.length
  const totalTime = (endTime - startTime) / 1000
  const requestsPerSecond = totalRequests / totalTime
  const errorRate = errors.length / totalRequests
  
  // Calculate percentiles
  const sortedResults = results.sort((a, b) => a - b)
  const p95Index = Math.floor(sortedResults.length * 0.95)
  const p99Index = Math.floor(sortedResults.length * 0.99)
  
  const averageResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length
  
  return {
    responseTime: averageResponseTime,
    memoryUsage: {
      heapUsed: 0, // Not meaningful for load tests
      heapTotal: 0,
      external: 0
    },
    requestsPerSecond,
    errorRate,
    p95ResponseTime: sortedResults[p95Index] || 0,
    p99ResponseTime: sortedResults[p99Index] || 0
  }
}

/**
 * Validates performance metrics against thresholds
 */
export function validatePerformance(
  metrics: PerformanceMetrics,
  thresholds: PerformanceThresholds
): { passed: boolean; failures: string[] } {
  const failures: string[] = []
  
  if (metrics.responseTime > thresholds.maxResponseTime) {
    failures.push(`Response time ${metrics.responseTime}ms exceeds threshold ${thresholds.maxResponseTime}ms`)
  }
  
  if (metrics.memoryUsage.heapUsed > thresholds.maxMemoryUsage) {
    failures.push(`Memory usage ${metrics.memoryUsage.heapUsed} bytes exceeds threshold ${thresholds.maxMemoryUsage} bytes`)
  }
  
  if (thresholds.minRequestsPerSecond && metrics.requestsPerSecond && metrics.requestsPerSecond < thresholds.minRequestsPerSecond) {
    failures.push(`Requests per second ${metrics.requestsPerSecond} below threshold ${thresholds.minRequestsPerSecond}`)
  }
  
  if (thresholds.maxErrorRate && metrics.errorRate && metrics.errorRate > thresholds.maxErrorRate) {
    failures.push(`Error rate ${metrics.errorRate * 100}% exceeds threshold ${thresholds.maxErrorRate * 100}%`)
  }
  
  if (thresholds.maxP95ResponseTime && metrics.p95ResponseTime && metrics.p95ResponseTime > thresholds.maxP95ResponseTime) {
    failures.push(`P95 response time ${metrics.p95ResponseTime}ms exceeds threshold ${thresholds.maxP95ResponseTime}ms`)
  }
  
  return {
    passed: failures.length === 0,
    failures
  }
}

/**
 * Runs a performance regression test
 */
export async function runPerformanceRegression(
  apiHandler: (req: NextRequest) => Promise<Response>,
  url: string,
  baselineMetrics: PerformanceMetrics,
  regressionThreshold: number = 0.2 // 20% regression threshold
): Promise<{ passed: boolean; regression: number; metrics: PerformanceMetrics }> {
  const request = createMockRequest('GET', url)
  const metrics = await measureApiPerformance(apiHandler, request)
  
  const regression = (metrics.responseTime - baselineMetrics.responseTime) / baselineMetrics.responseTime
  const passed = regression <= regressionThreshold
  
  return {
    passed,
    regression,
    metrics
  }
}

/**
 * Generates a performance report
 */
export function generatePerformanceReport(
  testName: string,
  metrics: PerformanceMetrics,
  thresholds?: PerformanceThresholds
): string {
  let report = `\n📊 Performance Report: ${testName}\n`
  report += `================================\n`
  report += `⏱️  Response Time: ${metrics.responseTime.toFixed(2)}ms\n`
  report += `💾  Memory Usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB\n`
  
  if (metrics.requestsPerSecond) {
    report += `🚀  Requests/sec: ${metrics.requestsPerSecond.toFixed(2)}\n`
  }
  
  if (metrics.errorRate !== undefined) {
    report += `❌  Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%\n`
  }
  
  if (metrics.p95ResponseTime) {
    report += `📈  P95 Response: ${metrics.p95ResponseTime.toFixed(2)}ms\n`
  }
  
  if (metrics.p99ResponseTime) {
    report += `📈  P99 Response: ${metrics.p99ResponseTime.toFixed(2)}ms\n`
  }
  
  if (thresholds) {
    const validation = validatePerformance(metrics, thresholds)
    report += `\n✅ Status: ${validation.passed ? 'PASSED' : 'FAILED'}\n`
    
    if (!validation.passed) {
      report += `❌ Failures:\n`
      validation.failures.forEach(failure => {
        report += `   - ${failure}\n`
      })
    }
  }
  
  return report
}

/**
 * Common performance thresholds for different endpoint types
 */
export const PERFORMANCE_THRESHOLDS = {
  search: {
    maxResponseTime: 2000, // 2 seconds for search
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    minRequestsPerSecond: 10,
    maxErrorRate: 0.01, // 1%
    maxP95ResponseTime: 3000
  },
  
  crud: {
    maxResponseTime: 500, // 500ms for CRUD operations
    maxMemoryUsage: 25 * 1024 * 1024, // 25MB
    minRequestsPerSecond: 50,
    maxErrorRate: 0.005, // 0.5%
    maxP95ResponseTime: 1000
  },
  
  analytics: {
    maxResponseTime: 5000, // 5 seconds for analytics
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    minRequestsPerSecond: 5,
    maxErrorRate: 0.01, // 1%
    maxP95ResponseTime: 8000
  },
  
  ai: {
    maxResponseTime: 30000, // 30 seconds for AI operations
    maxMemoryUsage: 200 * 1024 * 1024, // 200MB
    minRequestsPerSecond: 1,
    maxErrorRate: 0.02, // 2%
    maxP95ResponseTime: 45000
  }
} as const