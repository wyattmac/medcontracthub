/**
 * Queue Worker Process
 * Runs job processors for all queues
 */

import { queues } from './index'
import { processOCRJob } from './processors/ocr.processor'
import { processEmailJob, processBulkEmailJob } from './processors/email.processor'
import { apiLogger } from '@/lib/errors/logger'

// Configure concurrency
const CONCURRENCY = {
  ocr: parseInt(process.env.OCR_CONCURRENCY || '2'),
  email: parseInt(process.env.EMAIL_CONCURRENCY || '5'),
  sync: parseInt(process.env.SYNC_CONCURRENCY || '1'),
  export: parseInt(process.env.EXPORT_CONCURRENCY || '3'),
  analytics: parseInt(process.env.ANALYTICS_CONCURRENCY || '2')
}

export function startWorkers() {
  apiLogger.info('Starting queue workers', { concurrency: CONCURRENCY })

  // OCR Processing Worker
  queues.ocr.process('process-document', CONCURRENCY.ocr, processOCRJob)

  // Email Sending Worker
  queues.email.process('send-email', CONCURRENCY.email, processEmailJob)
  queues.email.process('send-bulk-email', CONCURRENCY.email, processBulkEmailJob)

  // Sync Worker (placeholder for now)
  queues.sync.process('sync-opportunities', CONCURRENCY.sync, async (job) => {
    apiLogger.info('Processing sync job', { data: job.data })
    // TODO: Implement sync processing
    return { success: true }
  })

  // Export Worker (placeholder for now)
  queues.export.process('generate-export', CONCURRENCY.export, async (job) => {
    apiLogger.info('Processing export job', { data: job.data })
    // TODO: Implement export processing
    return { success: true }
  })

  // Analytics Worker (placeholder for now)
  queues.analytics.process(CONCURRENCY.analytics, async (job) => {
    apiLogger.info('Processing analytics job', { data: job.data })
    // TODO: Implement analytics processing
    return { success: true }
  })

  // Set up recurring jobs
  setupRecurringJobs()

  apiLogger.info('All queue workers started successfully')
}

/**
 * Set up recurring jobs using cron-like scheduling
 */
async function setupRecurringJobs() {
  // Clean old jobs daily at 2 AM
  queues.ocr.add(
    'clean-old-jobs',
    { type: 'maintenance' },
    {
      repeat: { cron: '0 2 * * *' },
      jobId: 'clean-ocr-jobs'
    }
  )

  queues.email.add(
    'clean-old-jobs',
    { type: 'maintenance' },
    {
      repeat: { cron: '0 2 * * *' },
      jobId: 'clean-email-jobs'
    }
  )

  // Retry failed jobs every hour
  queues.ocr.add(
    'retry-failed',
    { type: 'maintenance' },
    {
      repeat: { cron: '0 * * * *' },
      jobId: 'retry-ocr-failed'
    }
  )

  apiLogger.info('Recurring jobs scheduled')
}

/**
 * Graceful shutdown
 */
export async function stopWorkers() {
  apiLogger.info('Stopping queue workers...')

  await Promise.all([
    queues.ocr.close(),
    queues.email.close(),
    queues.sync.close(),
    queues.export.close(),
    queues.analytics.close()
  ])

  apiLogger.info('All queue workers stopped')
}

// Handle process signals
if (process.env.NODE_ENV === 'production') {
  process.on('SIGTERM', async () => {
    apiLogger.info('SIGTERM received, shutting down gracefully...')
    await stopWorkers()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    apiLogger.info('SIGINT received, shutting down gracefully...')
    await stopWorkers()
    process.exit(0)
  })
}

// Start workers if this file is run directly
if (require.main === module) {
  startWorkers()
}