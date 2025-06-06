/**
 * User Journey Monitoring Scheduler
 * Manages continuous monitoring of user journeys
 */

import { createUserJourneyMonitor, CRITICAL_JOURNEYS, JourneyConfig, JourneyResult } from './user-journey-monitor'

export class MonitoringScheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private isRunning = false
  private monitor = createUserJourneyMonitor()

  /**
   * Start monitoring all journeys
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Monitoring scheduler already running')
      return
    }

    console.log('🚀 Starting user journey monitoring scheduler...')
    this.isRunning = true

    // Schedule each journey based on its frequency
    for (const journey of CRITICAL_JOURNEYS) {
      this.scheduleJourney(journey)
    }

    console.log(`✅ Scheduled ${CRITICAL_JOURNEYS.length} user journey monitors`)
  }

  /**
   * Stop all monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ Monitoring scheduler not running')
      return
    }

    console.log('🛑 Stopping user journey monitoring scheduler...')
    
    // Clear all intervals
    for (const [journeyName, interval] of this.intervals) {
      clearInterval(interval)
      console.log(`  📍 Stopped monitoring: ${journeyName}`)
    }

    this.intervals.clear()
    this.isRunning = false
    console.log('✅ All monitoring stopped')
  }

  /**
   * Schedule a specific journey
   */
  private scheduleJourney(journey: JourneyConfig): void {
    const intervalMs = journey.frequency * 60 * 1000 // Convert minutes to milliseconds

    console.log(`📅 Scheduling ${journey.name} every ${journey.frequency} minutes`)

    // Run immediately on start
    this.executeJourneyWithLogging(journey)

    // Schedule recurring execution
    const interval = setInterval(() => {
      this.executeJourneyWithLogging(journey)
    }, intervalMs)

    this.intervals.set(journey.name, interval)
  }

  /**
   * Execute journey with enhanced logging
   */
  private async executeJourneyWithLogging(journey: JourneyConfig): Promise<void> {
    const startTime = Date.now()
    
    try {
      console.log(`🔍 [${new Date().toISOString()}] Running scheduled journey: ${journey.name}`)
      
      const result = await this.monitor.executeJourney(journey)
      const duration = Date.now() - startTime

      if (result.success) {
        console.log(`✅ [${journey.name}] Completed successfully (${duration}ms)`)
        
        // Log performance insights
        const slowSteps = result.stepResults.filter(step => step.performanceScore === 'poor')
        if (slowSteps.length > 0) {
          console.warn(`⚠️ [${journey.name}] Performance concerns:`, 
            slowSteps.map(s => `${s.stepName}: ${s.responseTime}ms`))
        }
      } else {
        console.error(`❌ [${journey.name}] Failed: ${result.error}`)
        
        // Log detailed failure information
        const failedSteps = result.stepResults.filter(step => !step.success)
        for (const step of failedSteps) {
          console.error(`  💥 Step "${step.stepName}" failed: ${step.error}`)
        }
      }

      // Store result for trend analysis
      await this.storeResult(journey, result)

    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`💥 [${journey.name}] Scheduler error (${duration}ms):`, error)
    }
  }

  /**
   * Store monitoring result for analysis
   */
  private async storeResult(journey: JourneyConfig, result: JourneyResult): Promise<void> {
    // In a real implementation, this would store to database or time-series DB
    // For now, we'll implement basic file-based storage for development
    
    const logEntry = {
      timestamp: result.timestamp.toISOString(),
      journey: journey.name,
      success: result.success,
      totalTime: result.totalTime,
      stepCount: result.stepResults.length,
      performanceScore: this.calculateOverallPerformanceScore(result.stepResults),
      error: result.error
    }

    // Log to console with structured format for easy parsing
    console.log(`📊 MONITOR_RESULT: ${JSON.stringify(logEntry)}`)
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallPerformanceScore(stepResults: any[]): string {
    const scores = stepResults.map(step => step.performanceScore)
    const poorCount = scores.filter(s => s === 'poor').length
    const needsImprovementCount = scores.filter(s => s === 'needs-improvement').length
    
    if (poorCount > 0) return 'poor'
    if (needsImprovementCount > 0) return 'needs-improvement'
    return 'good'
  }

  /**
   * Get monitoring status
   */
  getStatus(): { isRunning: boolean; scheduledJourneys: number; activeMonitors: string[] } {
    return {
      isRunning: this.isRunning,
      scheduledJourneys: this.intervals.size,
      activeMonitors: Array.from(this.intervals.keys())
    }
  }

  /**
   * Run a one-time check of all journeys
   */
  async runHealthCheck(): Promise<{ success: boolean; results: JourneyResult[] }> {
    console.log('🔬 Running one-time health check...')
    
    const results = await this.monitor.runAllJourneys()
    const allSuccessful = results.every(r => r.success)
    
    console.log(`🎯 Health check complete: ${results.filter(r => r.success).length}/${results.length} journeys passed`)
    
    return {
      success: allSuccessful,
      results
    }
  }
}

// Global scheduler instance
let globalScheduler: MonitoringScheduler | null = null

/**
 * Get or create global monitoring scheduler
 */
export function getGlobalScheduler(): MonitoringScheduler {
  if (!globalScheduler) {
    globalScheduler = new MonitoringScheduler()
  }
  return globalScheduler
}

/**
 * Start global monitoring (call this at app startup)
 */
export function startGlobalMonitoring(): void {
  // Only start in production or when explicitly enabled
  const shouldMonitor = process.env.NODE_ENV === 'production' || 
                       process.env.ENABLE_USER_JOURNEY_MONITORING === 'true'
  
  if (shouldMonitor) {
    const scheduler = getGlobalScheduler()
    scheduler.start()
  } else {
    console.log('📊 User journey monitoring disabled (set ENABLE_USER_JOURNEY_MONITORING=true to enable)')
  }
}

/**
 * Stop global monitoring (call this at app shutdown)
 */
export function stopGlobalMonitoring(): void {
  if (globalScheduler) {
    globalScheduler.stop()
    globalScheduler = null
  }
}