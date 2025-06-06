/**
 * Smart Data Prefetching for SAM.gov API
 * Intelligently prefetches common queries during low usage periods
 */

import { getSAMApiClient } from './client'
import { getSAMQuotaManager, CallPriority } from './quota-manager'
import { createServiceClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/errors/logger'
import { searchCache } from '@/lib/utils/cache'

interface PrefetchTask {
  id: string
  priority: number
  naicsCode?: string
  searchQuery?: string
  estimatedCalls: number
  lastExecuted?: Date
  frequency: 'daily' | 'weekly' | 'monthly'
}

export class PrefetchManager {
  private isRunning = false
  private tasks: PrefetchTask[] = []

  constructor() {
    this.initializeCommonTasks()
  }

  /**
   * Initialize common prefetch tasks based on platform usage
   */
  private initializeCommonTasks() {
    // Common medical NAICS codes to prefetch
    const medicalNaics = [
      '423450', // Medical equipment wholesalers
      '339112', // Surgical instruments
      '339113', // Medical supplies
      '621210', // Dental offices
      '622110', // General hospitals
    ]

    this.tasks = [
      // High-priority: Most common searches
      ...medicalNaics.slice(0, 3).map((naics, index) => ({
        id: `naics-${naics}`,
        priority: 10 - index,
        naicsCode: naics,
        estimatedCalls: 1,
        frequency: 'daily' as const
      })),

      // Medium-priority: Common search terms
      {
        id: 'search-medical-supplies',
        priority: 7,
        searchQuery: 'medical supplies',
        estimatedCalls: 1,
        frequency: 'daily' as const
      },
      {
        id: 'search-hospital-equipment',
        priority: 6,
        searchQuery: 'hospital equipment',
        estimatedCalls: 1,
        frequency: 'daily' as const
      },

      // Low-priority: Additional NAICS codes
      ...medicalNaics.slice(3).map((naics, index) => ({
        id: `naics-secondary-${naics}`,
        priority: 3 - index,
        naicsCode: naics,
        estimatedCalls: 1,
        frequency: 'weekly' as const
      }))
    ]
  }

  /**
   * Execute prefetch tasks during optimal windows
   */
  async executePrefetch(): Promise<void> {
    if (this.isRunning) {
      apiLogger.debug('Prefetch already running, skipping')
      return
    }

    this.isRunning = true

    try {
      const quotaManager = getSAMQuotaManager()
      const quotaStatus = await quotaManager.getQuotaStatus()

      // Only prefetch if we have sufficient quota
      if (quotaStatus.daily.remaining < 300) {
        apiLogger.debug('Insufficient quota for prefetching', {
          remaining: quotaStatus.daily.remaining
        })
        return
      }

      // Check if we're in an optimal time window
      const currentHour = new Date().getHours()
      const isOptimalWindow = this.isOptimalPrefetchWindow(currentHour, quotaStatus.analytics.hourlyPattern)

      if (!isOptimalWindow && quotaStatus.daily.remaining < 500) {
        apiLogger.debug('Not in optimal window and quota not abundant', {
          currentHour,
          remaining: quotaStatus.daily.remaining
        })
        return
      }

      // Get tasks that need execution
      const tasksToExecute = await this.getTasksToExecute()
      
      // Sort by priority (highest first)
      tasksToExecute.sort((a, b) => b.priority - a.priority)

      // Execute tasks within quota limits
      let executed = 0
      const maxExecutions = Math.min(
        5, // Never execute more than 5 prefetch tasks at once
        Math.floor(quotaStatus.daily.remaining / 10) // Use max 10% of remaining quota
      )

      for (const task of tasksToExecute) {
        if (executed >= maxExecutions) break

        try {
          await this.executeTask(task)
          executed++
          
          // Update last executed time
          await this.updateTaskExecution(task.id)
          
          // Small delay between tasks to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000))
          
        } catch (error) {
          apiLogger.error('Prefetch task failed', error as Error, { taskId: task.id })
          // Continue with other tasks
        }
      }

      apiLogger.info('Prefetch completed', {
        executed,
        available: tasksToExecute.length,
        quotaRemaining: quotaStatus.daily.remaining - executed
      })

    } catch (error) {
      apiLogger.error('Prefetch execution failed', error as Error)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Check if current time is optimal for prefetching
   */
  private isOptimalPrefetchWindow(currentHour: number, hourlyPattern: Array<{ hour: number; count: number }>): boolean {
    // Find average usage
    const totalUsage = hourlyPattern.reduce((sum, h) => sum + h.count, 0)
    const averageUsage = totalUsage / 24

    // Get current hour usage
    const currentUsage = hourlyPattern.find(h => h.hour === currentHour)?.count || 0

    // Optimal window: usage is below 50% of average
    return currentUsage < averageUsage * 0.5
  }

  /**
   * Get tasks that need to be executed
   */
  private async getTasksToExecute(): Promise<PrefetchTask[]> {
    const now = new Date()
    const tasksToExecute: PrefetchTask[] = []

    for (const task of this.tasks) {
      // Check if task needs execution based on frequency
      const needsExecution = await this.taskNeedsExecution(task, now)
      
      if (needsExecution) {
        // Check if data is already cached
        const cacheKey = this.getCacheKeyForTask(task)
        const cached = searchCache.get(cacheKey)
        
        if (!cached) {
          tasksToExecute.push(task)
        }
      }
    }

    return tasksToExecute
  }

  /**
   * Execute a single prefetch task
   */
  private async executeTask(task: PrefetchTask): Promise<void> {
    const samClient = getSAMApiClient()
    
    if (task.naicsCode) {
      // Prefetch by NAICS code
      await samClient.searchOpportunities({
        naicsCode: task.naicsCode,
        active: true,
        limit: 25
      }, undefined, CallPriority.LOW)
      
    } else if (task.searchQuery) {
      // Prefetch by search query
      await samClient.searchOpportunities({
        searchQuery: task.searchQuery,
        active: true,
        limit: 25
      }, undefined, CallPriority.LOW)
    }

    apiLogger.debug('Prefetch task executed', {
      taskId: task.id,
      naicsCode: task.naicsCode,
      searchQuery: task.searchQuery
    })
  }

  /**
   * Check if task needs execution based on frequency
   */
  private async taskNeedsExecution(task: PrefetchTask, now: Date): Promise<boolean> {
    if (!task.lastExecuted) return true

    const hoursSinceLastExecution = (now.getTime() - task.lastExecuted.getTime()) / (1000 * 60 * 60)

    switch (task.frequency) {
      case 'daily':
        return hoursSinceLastExecution >= 24
      case 'weekly':
        return hoursSinceLastExecution >= 168 // 7 days
      case 'monthly':
        return hoursSinceLastExecution >= 720 // 30 days
      default:
        return false
    }
  }

  /**
   * Generate cache key for task
   */
  private getCacheKeyForTask(task: PrefetchTask): string {
    if (task.naicsCode) {
      return `sam_opportunities:naicsCode=${task.naicsCode}&active=true&limit=25`
    } else if (task.searchQuery) {
      return `sam_opportunities:searchQuery=${encodeURIComponent(task.searchQuery)}&active=true&limit=25`
    }
    return `sam_opportunities:task=${task.id}`
  }

  /**
   * Update task execution timestamp
   */
  private async updateTaskExecution(taskId: string): Promise<void> {
    const task = this.tasks.find(t => t.id === taskId)
    if (task) {
      task.lastExecuted = new Date()
    }

    // Store in database for persistence
    try {
      const supabase = createServiceClient()
      await supabase
        .from('prefetch_tasks')
        .upsert({
          task_id: taskId,
          last_executed: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
    } catch (error) {
      apiLogger.error('Failed to update task execution', error as Error, { taskId })
    }
  }

  /**
   * Add custom prefetch task based on user behavior
   */
  async addUserBasedTask(userId: string, searchPattern: any): Promise<void> {
    // Analyze user search patterns and add high-value prefetch tasks
    if (searchPattern.naicsCode && searchPattern.frequency > 3) {
      const taskId = `user-${userId}-naics-${searchPattern.naicsCode}`
      
      if (!this.tasks.find(t => t.id === taskId)) {
        this.tasks.push({
          id: taskId,
          priority: Math.min(8, searchPattern.frequency), // Cap at 8
          naicsCode: searchPattern.naicsCode,
          estimatedCalls: 1,
          frequency: 'daily' as const
        })

        apiLogger.info('Added user-based prefetch task', {
          userId,
          taskId,
          naicsCode: searchPattern.naicsCode
        })
      }
    }
  }
}

// Singleton instance
let _prefetchManager: PrefetchManager | null = null

export function getPrefetchManager(): PrefetchManager {
  if (!_prefetchManager) {
    _prefetchManager = new PrefetchManager()
  }
  return _prefetchManager
}

/**
 * Schedule prefetch execution (to be called by cron job or background worker)
 */
export async function scheduledPrefetch(): Promise<void> {
  const prefetchManager = getPrefetchManager()
  await prefetchManager.executePrefetch()
}