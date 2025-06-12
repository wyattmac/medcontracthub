/**
 * OCR Service Load Test
 * Tests performance and scalability of the OCR microservice
 */

import { testSetup } from '../setup'
import { readFileSync } from 'fs'
import { join } from 'path'
import FormData from 'form-data'

interface LoadTestResult {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  requestsPerSecond: number
  errors: Map<string, number>
}

export class OCRLoadTest {
  private results: LoadTestResult = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    requestsPerSecond: 0,
    errors: new Map()
  }

  private responseTimes: number[] = []
  private testPdfBuffer: Buffer

  constructor() {
    // Load test PDF once
    const testPdfPath = join(__dirname, '../../../fixtures/test-rfp.pdf')
    this.testPdfBuffer = readFileSync(testPdfPath)
  }

  /**
   * Run load test with specified parameters
   */
  async runLoadTest(
    concurrentUsers: number,
    duration: number,
    requestsPerUser: number,
    token: string
  ): Promise<LoadTestResult> {
    console.log(`Starting OCR load test: ${concurrentUsers} users, ${duration}s duration`)
    
    const startTime = Date.now()
    const endTime = startTime + (duration * 1000)
    
    // Create worker promises
    const workers = Array(concurrentUsers).fill(null).map((_, index) => 
      this.simulateUser(index, requestsPerUser, endTime, token)
    )

    // Wait for all workers to complete
    await Promise.all(workers)

    // Calculate results
    this.calculateMetrics(startTime)
    
    return this.results
  }

  /**
   * Simulate a single user making requests
   */
  private async simulateUser(
    userId: number,
    maxRequests: number,
    endTime: number,
    token: string
  ): Promise<void> {
    const gateway = testSetup.getHttpClient('gateway')
    let requestCount = 0

    while (Date.now() < endTime && requestCount < maxRequests) {
      const startTime = Date.now()
      
      try {
        const formData = new FormData()
        formData.append('file', this.testPdfBuffer, `test-user-${userId}-req-${requestCount}.pdf`)
        formData.append('noticeId', `LOAD-TEST-${userId}-${requestCount}`)
        formData.append('title', `Load Test Document ${requestCount}`)

        const response = await gateway.post('/api/ocr/process', formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`
          },
          timeout: 30000
        })

        const responseTime = Date.now() - startTime
        this.responseTimes.push(responseTime)
        this.results.successfulRequests++

        // Simulate think time between requests
        await this.randomDelay(500, 2000)
        
      } catch (error: any) {
        this.results.failedRequests++
        const errorType = error.response?.status || 'network_error'
        this.results.errors.set(
          errorType.toString(),
          (this.results.errors.get(errorType.toString()) || 0) + 1
        )
      }

      this.results.totalRequests++
      requestCount++
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(startTime: number): void {
    if (this.responseTimes.length === 0) return

    // Sort response times for percentile calculations
    this.responseTimes.sort((a, b) => a - b)

    // Calculate average
    const sum = this.responseTimes.reduce((a, b) => a + b, 0)
    this.results.avgResponseTime = Math.round(sum / this.responseTimes.length)

    // Calculate percentiles
    const p95Index = Math.floor(this.responseTimes.length * 0.95)
    const p99Index = Math.floor(this.responseTimes.length * 0.99)
    
    this.results.p95ResponseTime = this.responseTimes[p95Index] || 0
    this.results.p99ResponseTime = this.responseTimes[p99Index] || 0

    // Calculate requests per second
    const duration = (Date.now() - startTime) / 1000
    this.results.requestsPerSecond = this.results.totalRequests / duration
  }

  /**
   * Random delay helper
   */
  private randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min
    return new Promise(resolve => setTimeout(resolve, delay))
  }

  /**
   * Print results summary
   */
  printResults(): void {
    console.log('\n=== OCR Service Load Test Results ===')
    console.log(`Total Requests: ${this.results.totalRequests}`)
    console.log(`Successful: ${this.results.successfulRequests} (${(this.results.successfulRequests / this.results.totalRequests * 100).toFixed(2)}%)`)
    console.log(`Failed: ${this.results.failedRequests} (${(this.results.failedRequests / this.results.totalRequests * 100).toFixed(2)}%)`)
    console.log(`\nPerformance Metrics:`)
    console.log(`Average Response Time: ${this.results.avgResponseTime}ms`)
    console.log(`P95 Response Time: ${this.results.p95ResponseTime}ms`)
    console.log(`P99 Response Time: ${this.results.p99ResponseTime}ms`)
    console.log(`Requests/Second: ${this.results.requestsPerSecond.toFixed(2)}`)
    
    if (this.results.errors.size > 0) {
      console.log(`\nErrors:`)
      this.results.errors.forEach((count, error) => {
        console.log(`  ${error}: ${count}`)
      })
    }
  }
}

// Run load test if executed directly
if (require.main === module) {
  (async () => {
    try {
      await testSetup.waitForServices(['gateway', 'ocr'])
      
      // Create test user and get token
      const { user, token } = await testSetup.createTestUser()
      
      const loadTest = new OCRLoadTest()
      
      // Run progressive load tests
      const testScenarios = [
        { users: 5, duration: 30, requestsPerUser: 10 },
        { users: 10, duration: 60, requestsPerUser: 20 },
        { users: 20, duration: 120, requestsPerUser: 30 }
      ]

      for (const scenario of testScenarios) {
        console.log(`\n--- Scenario: ${scenario.users} users ---`)
        await loadTest.runLoadTest(
          scenario.users,
          scenario.duration,
          scenario.requestsPerUser,
          token
        )
        loadTest.printResults()
        
        // Cool down between tests
        await new Promise(resolve => setTimeout(resolve, 10000))
      }

      // Cleanup
      await testSetup.cleanupTestUser(user.id)
      await testSetup.cleanup()
      
    } catch (error) {
      console.error('Load test failed:', error)
      process.exit(1)
    }
  })()
}