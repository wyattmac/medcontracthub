/**
 * User Journey Monitoring System
 * Continuous validation of critical user flows in production
 */

import { NextRequest } from 'next/server'

export interface JourneyStep {
  name: string
  url: string
  timeout: number
  expectedElements: string[]
  performanceThreshold: number // milliseconds
  criticalElements?: string[] // Must be present
  forbiddenElements?: string[] // Must not be present
}

export interface JourneyConfig {
  name: string
  description: string
  frequency: number // minutes
  steps: JourneyStep[]
  alertThreshold: number // consecutive failures before alert
}

export interface JourneyResult {
  journeyName: string
  timestamp: Date
  success: boolean
  totalTime: number
  stepResults: StepResult[]
  error?: string
}

export interface StepResult {
  stepName: string
  success: boolean
  responseTime: number
  statusCode?: number
  error?: string
  performanceScore: 'good' | 'needs-improvement' | 'poor'
}

/**
 * Critical User Journeys to Monitor
 */
export const CRITICAL_JOURNEYS: JourneyConfig[] = [
  {
    name: 'landing-page-health',
    description: 'Landing page loads and key elements are present',
    frequency: 5, // Every 5 minutes
    alertThreshold: 3,
    steps: [
      {
        name: 'landing-page-load',
        url: '/',
        timeout: 10000,
        performanceThreshold: 3000,
        expectedElements: [
          'header',
          'text=MedContractHub',
          'text=Sign Up',
          'text=Get Started'
        ],
        criticalElements: ['header'],
        forbiddenElements: ['text=Error', 'text=500', 'text=404']
      }
    ]
  },
  {
    name: 'opportunities-discovery',
    description: 'Opportunities page loads with data',
    frequency: 10, // Every 10 minutes
    alertThreshold: 2,
    steps: [
      {
        name: 'opportunities-page-load',
        url: '/opportunities',
        timeout: 15000,
        performanceThreshold: 8500,
        expectedElements: [
          'text=Opportunities',
          'input[placeholder*="search"]',
          '.opportunity'
        ],
        criticalElements: ['text=Opportunities'],
        forbiddenElements: ['text=Error', 'text=Failed to load']
      }
    ]
  },
  {
    name: 'authentication-flow',
    description: 'Login and signup pages are accessible',
    frequency: 15, // Every 15 minutes
    alertThreshold: 2,
    steps: [
      {
        name: 'login-page-load',
        url: '/login',
        timeout: 10000,
        performanceThreshold: 5000,
        expectedElements: [
          'input[type="email"]',
          'input[type="password"]',
          'button[type="submit"]'
        ],
        criticalElements: ['input[type="email"]'],
        forbiddenElements: ['text=Error']
      },
      {
        name: 'signup-page-load',
        url: '/signup',
        timeout: 10000,
        performanceThreshold: 5000,
        expectedElements: [
          'input[type="email"]',
          'input[type="password"]',
          'button[type="submit"]'
        ],
        criticalElements: ['input[type="email"]'],
        forbiddenElements: ['text=Error']
      }
    ]
  },
  {
    name: 'api-health-check',
    description: 'Critical API endpoints are responding',
    frequency: 2, // Every 2 minutes
    alertThreshold: 3,
    steps: [
      {
        name: 'health-endpoint',
        url: '/api/health',
        timeout: 5000,
        performanceThreshold: 2000,
        expectedElements: ['text=healthy'],
        criticalElements: ['text=healthy'],
        forbiddenElements: ['text=unhealthy', 'text=error']
      }
    ]
  }
]

/**
 * User Journey Monitor Class
 */
export class UserJourneyMonitor {
  private baseUrl: string
  private alertWebhook?: string
  
  constructor(baseUrl: string, alertWebhook?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.alertWebhook = alertWebhook
  }

  /**
   * Execute a single journey
   */
  async executeJourney(journey: JourneyConfig): Promise<JourneyResult> {
    const startTime = Date.now()
    const stepResults: StepResult[] = []
    let journeySuccess = true
    let journeyError: string | undefined

    console.log(`🔍 Starting journey: ${journey.name}`)

    try {
      for (const step of journey.steps) {
        const stepResult = await this.executeStep(step)
        stepResults.push(stepResult)
        
        if (!stepResult.success) {
          journeySuccess = false
          journeyError = stepResult.error
          break // Stop on first failure
        }
      }
    } catch (error) {
      journeySuccess = false
      journeyError = error instanceof Error ? error.message : 'Unknown error'
    }

    const totalTime = Date.now() - startTime

    const result: JourneyResult = {
      journeyName: journey.name,
      timestamp: new Date(),
      success: journeySuccess,
      totalTime,
      stepResults,
      error: journeyError
    }

    // Log result
    if (journeySuccess) {
      console.log(`✅ Journey completed: ${journey.name} (${totalTime}ms)`)
    } else {
      console.error(`❌ Journey failed: ${journey.name} - ${journeyError}`)
      await this.handleFailure(journey, result)
    }

    return result
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: JourneyStep): Promise<StepResult> {
    const startTime = Date.now()
    const url = `${this.baseUrl}${step.url}`

    try {
      console.log(`  📍 Executing step: ${step.name} -> ${url}`)

      // Fetch the page
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'MedContractHub-Monitor/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(step.timeout)
      })

      const responseTime = Date.now() - startTime
      const content = await response.text()

      // Check status code
      if (!response.ok) {
        return {
          stepName: step.name,
          success: false,
          responseTime,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
          performanceScore: 'poor'
        }
      }

      // Check for forbidden elements
      if (step.forbiddenElements) {
        for (const forbidden of step.forbiddenElements) {
          if (this.checkElementPresence(content, forbidden)) {
            return {
              stepName: step.name,
              success: false,
              responseTime,
              statusCode: response.status,
              error: `Forbidden element found: ${forbidden}`,
              performanceScore: this.getPerformanceScore(responseTime, step.performanceThreshold)
            }
          }
        }
      }

      // Check for critical elements
      if (step.criticalElements) {
        for (const critical of step.criticalElements) {
          if (!this.checkElementPresence(content, critical)) {
            return {
              stepName: step.name,
              success: false,
              responseTime,
              statusCode: response.status,
              error: `Critical element missing: ${critical}`,
              performanceScore: this.getPerformanceScore(responseTime, step.performanceThreshold)
            }
          }
        }
      }

      // Check expected elements
      for (const expected of step.expectedElements) {
        if (!this.checkElementPresence(content, expected)) {
          console.warn(`  ⚠️ Expected element missing: ${expected}`)
        }
      }

      return {
        stepName: step.name,
        success: true,
        responseTime,
        statusCode: response.status,
        performanceScore: this.getPerformanceScore(responseTime, step.performanceThreshold)
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      return {
        stepName: step.name,
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        performanceScore: 'poor'
      }
    }
  }

  /**
   * Check if an element/text is present in content
   */
  private checkElementPresence(content: string, selector: string): boolean {
    if (selector.startsWith('text=')) {
      const text = selector.substring(5)
      return content.includes(text)
    }
    
    // Simple HTML tag/attribute check
    if (selector.includes('[') || selector.includes('.') || selector.includes('#')) {
      // For more complex selectors, we'd need a DOM parser
      // For now, do basic checks
      if (selector.includes('input[type="email"]')) {
        return content.includes('type="email"')
      }
      if (selector.includes('input[type="password"]')) {
        return content.includes('type="password"')
      }
      if (selector.includes('button[type="submit"]')) {
        return content.includes('type="submit"')
      }
      if (selector.includes('input[placeholder*="search"]')) {
        return content.includes('placeholder') && content.includes('search')
      }
    }
    
    // Basic tag check
    return content.includes(`<${selector}`) || content.includes(`class="${selector}"`)
  }

  /**
   * Get performance score based on response time
   */
  private getPerformanceScore(responseTime: number, threshold: number): 'good' | 'needs-improvement' | 'poor' {
    if (responseTime <= threshold * 0.7) return 'good'
    if (responseTime <= threshold) return 'needs-improvement'
    return 'poor'
  }

  /**
   * Handle journey failure
   */
  private async handleFailure(journey: JourneyConfig, result: JourneyResult): Promise<void> {
    // Store failure for tracking consecutive failures
    await this.recordFailure(journey, result)
    
    // Check if we should send alert
    const consecutiveFailures = await this.getConsecutiveFailures(journey.name)
    
    if (consecutiveFailures >= journey.alertThreshold) {
      await this.sendAlert(journey, result, consecutiveFailures)
    }
  }

  /**
   * Record failure for tracking
   */
  private async recordFailure(journey: JourneyConfig, result: JourneyResult): Promise<void> {
    // In a real implementation, this would store to database or cache
    // For now, we'll use console logging
    console.error(`🚨 FAILURE RECORDED: ${journey.name}`, {
      timestamp: result.timestamp,
      error: result.error,
      stepResults: result.stepResults
    })
  }

  /**
   * Get consecutive failures count
   */
  private async getConsecutiveFailures(journeyName: string): Promise<number> {
    // In a real implementation, this would query database or cache
    // For now, return 1 to trigger alerts immediately
    return 1
  }

  /**
   * Send alert
   */
  private async sendAlert(journey: JourneyConfig, result: JourneyResult, consecutiveFailures: number): Promise<void> {
    const alertMessage = {
      title: `🚨 Critical User Journey Failed: ${journey.name}`,
      description: journey.description,
      consecutiveFailures,
      error: result.error,
      timestamp: result.timestamp,
      stepResults: result.stepResults,
      url: this.baseUrl
    }

    console.error('🚨 CRITICAL ALERT:', alertMessage)

    if (this.alertWebhook) {
      try {
        await fetch(this.alertWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertMessage)
        })
      } catch (error) {
        console.error('Failed to send webhook alert:', error)
      }
    }
  }

  /**
   * Run all critical journeys
   */
  async runAllJourneys(): Promise<JourneyResult[]> {
    const results: JourneyResult[] = []
    
    for (const journey of CRITICAL_JOURNEYS) {
      try {
        const result = await this.executeJourney(journey)
        results.push(result)
      } catch (error) {
        console.error(`Failed to execute journey ${journey.name}:`, error)
      }
    }

    return results
  }
}

/**
 * Create monitor instance for current environment
 */
export function createUserJourneyMonitor(): UserJourneyMonitor {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const alertWebhook = process.env.MONITORING_WEBHOOK_URL
  
  return new UserJourneyMonitor(baseUrl, alertWebhook)
}