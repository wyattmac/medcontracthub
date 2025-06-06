/**
 * Bull.js Job Queue Configuration
 * Handles async processing for OCR, emails, and other background tasks
 */

import Bull from 'bull'
import { redis } from '@/lib/redis/client'
import { apiLogger } from '@/lib/errors/logger'

// Queue configurations
const defaultJobOptions: Bull.JobOptions = {
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 500, // Keep last 500 failed jobs
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
}

// Create queue factory
function createQueue<T = any>(
  name: string,
  options?: Bull.QueueOptions
): Bull.Queue<T> {
  const redisUrl = process.env.REDIS_URL

  const queue = redisUrl 
    ? new Bull<T>(name, redisUrl, options)
    : new Bull<T>(name, {
        redis: {
          port: parseInt(process.env.REDIS_PORT || '6379'),
          host: process.env.REDIS_HOST || 'localhost',
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0')
        },
        ...options
      })

  // Queue event handlers
  queue.on('error', (error) => {
    apiLogger.error(`Queue ${name} error`, error)
  })

  queue.on('waiting', (jobId) => {
    apiLogger.debug(`Job ${jobId} waiting in queue ${name}`)
  })

  queue.on('active', (job) => {
    apiLogger.info(`Job ${job.id} active in queue ${name}`, {
      data: job.data,
      attemptsMade: job.attemptsMade
    })
  })

  queue.on('completed', (job, result) => {
    apiLogger.info(`Job ${job.id} completed in queue ${name}`, {
      result,
      processingTime: Date.now() - job.timestamp
    })
  })

  queue.on('failed', (job, error) => {
    apiLogger.error(`Job ${job.id} failed in queue ${name}`, error, {
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason
    })
  })

  queue.on('stalled', (job) => {
    apiLogger.warn(`Job ${job.id} stalled in queue ${name}`, {
      data: job.data
    })
  })

  return queue
}

// Define job types
export interface IOCRJob {
  opportunityId: string
  documentId: string
  documentUrl: string
  fileName: string
  companyId: string
  userId: string
  priority?: number
}

export interface IEmailJob {
  to: string
  subject: string
  template: string
  data: Record<string, any>
  userId?: string
}

export interface IBulkEmailJob {
  template: string
  recipients: Array<{
    to: string
    data: Record<string, any>
    userId?: string
  }>
  subject: string
}

export interface ISyncJob {
  type: 'full' | 'incremental'
  naicsFilter?: string[]
  userId?: string
  forceSync?: boolean
}

export interface IExportJob {
  type: 'opportunities' | 'analytics' | 'proposals'
  format: 'pdf' | 'excel'
  filters?: Record<string, any>
  userId: string
  email: string
}

// Create queues
export const queues = {
  ocr: createQueue<IOCRJob>('ocr-processing'),
  email: createQueue<IEmailJob>('email-sending'),
  sync: createQueue<ISyncJob>('opportunity-sync'),
  export: createQueue<IExportJob>('export-generation'),
  analytics: createQueue('analytics-processing')
}

// Queue helpers
export const jobQueue = {
  // Add OCR job
  async addOCRJob(data: IOCRJob, options?: Bull.JobOptions): Promise<Bull.Job<IOCRJob>> {
    return queues.ocr.add('process-document', data, {
      ...defaultJobOptions,
      priority: data.priority || 0,
      delay: 0,
      ...options
    })
  },

  // Add email job
  async addEmailJob(data: IEmailJob, options?: Bull.JobOptions): Promise<Bull.Job<IEmailJob>> {
    return queues.email.add('send-email', data, {
      ...defaultJobOptions,
      attempts: 5, // More attempts for emails
      backoff: {
        type: 'exponential',
        delay: 5000 // 5 second initial delay
      },
      ...options
    })
  },

  // Add sync job
  async addSyncJob(data: ISyncJob, options?: Bull.JobOptions): Promise<Bull.Job<ISyncJob>> {
    // Prevent duplicate sync jobs
    const jobs = await queues.sync.getJobs(['waiting', 'active'])
    const duplicateJob = jobs.find(job => 
      job.data.type === data.type && 
      JSON.stringify(job.data.naicsFilter) === JSON.stringify(data.naicsFilter)
    )

    if (duplicateJob) {
      apiLogger.warn('Duplicate sync job prevented', { existingJobId: duplicateJob.id })
      return duplicateJob
    }

    return queues.sync.add('sync-opportunities', data, {
      ...defaultJobOptions,
      attempts: 1, // Don't retry sync jobs
      timeout: 5 * 60 * 1000, // 5 minute timeout
      ...options
    })
  },

  // Add export job
  async addExportJob(data: IExportJob, options?: Bull.JobOptions): Promise<Bull.Job<IExportJob>> {
    return queues.export.add('generate-export', data, {
      ...defaultJobOptions,
      timeout: 2 * 60 * 1000, // 2 minute timeout
      ...options
    })
  },

  // Bulk add jobs
  async bulkAdd<T>(
    queue: Bull.Queue<T>,
    jobs: Array<{ name: string; data: T; opts?: Bull.JobOptions }>
  ): Promise<Bull.Job<T>[]> {
    return queue.addBulk(jobs.map(job => ({
      ...job,
      opts: { ...defaultJobOptions, ...job.opts }
    })))
  },

  // Get job status
  async getJobStatus(queue: Bull.Queue, jobId: string): Promise<{
    status: string
    progress: number
    result?: any
    error?: string
  } | null> {
    const job = await queue.getJob(jobId)
    
    if (!job) {
      return null
    }

    const state = await job.getState()
    
    return {
      status: state,
      progress: job.progress(),
      result: job.returnvalue,
      error: job.failedReason
    }
  },

  // Get queue metrics
  async getQueueMetrics(queueName: keyof typeof queues): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
    paused: boolean
  }> {
    const queue = queues[queueName]
    
    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused
    ] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused()
    ])

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused
    }
  },

  // Clean old jobs
  async cleanQueue(
    queueName: keyof typeof queues,
    grace: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<void> {
    const queue = queues[queueName]
    
    await queue.clean(grace, 'completed')
    await queue.clean(grace * 7, 'failed') // Keep failed jobs longer
    
    apiLogger.info(`Cleaned old jobs from queue ${queueName}`)
  },

  // Pause/Resume queue
  async pauseQueue(queueName: keyof typeof queues): Promise<void> {
    await queues[queueName].pause()
    apiLogger.info(`Queue ${queueName} paused`)
  },

  async resumeQueue(queueName: keyof typeof queues): Promise<void> {
    await queues[queueName].resume()
    apiLogger.info(`Queue ${queueName} resumed`)
  },

  // Retry failed jobs
  async retryFailedJobs(queueName: keyof typeof queues, limit: number = 10): Promise<number> {
    const queue = queues[queueName]
    const failedJobs = await queue.getFailed(0, limit)
    
    let retried = 0
    for (const job of failedJobs) {
      await job.retry()
      retried++
    }
    
    apiLogger.info(`Retried ${retried} failed jobs in queue ${queueName}`)
    return retried
  },

  // Get job by ID
  async getJob<T = any>(queueName: keyof typeof queues, jobId: string): Promise<Bull.Job<T> | null> {
    return queues[queueName].getJob(jobId) as Promise<Bull.Job<T> | null>
  },

  // Remove job
  async removeJob(queueName: keyof typeof queues, jobId: string): Promise<void> {
    const job = await queues[queueName].getJob(jobId)
    if (job) {
      await job.remove()
      apiLogger.info(`Removed job ${jobId} from queue ${queueName}`)
    }
  }
}

// Export types
export type { Bull }