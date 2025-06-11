import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export const registry = new Registry();

// Job metrics
export const jobsProcessed = new Counter({
  name: 'worker_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue', 'status'],
  registers: [registry],
});

export const jobDuration = new Histogram({
  name: 'worker_job_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['queue', 'job_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
  registers: [registry],
});

export const activeJobs = new Gauge({
  name: 'worker_active_jobs',
  help: 'Number of currently active jobs',
  labelNames: ['queue'],
  registers: [registry],
});

export const queueSize = new Gauge({
  name: 'worker_queue_size',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue'],
  registers: [registry],
});

// Email metrics
export const emailsSent = new Counter({
  name: 'worker_emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['type', 'status'],
  registers: [registry],
});

// Sync metrics
export const syncOperations = new Counter({
  name: 'worker_sync_operations_total',
  help: 'Total number of sync operations',
  labelNames: ['source', 'status'],
  registers: [registry],
});

export const syncDuration = new Histogram({
  name: 'worker_sync_duration_seconds',
  help: 'Sync operation duration in seconds',
  labelNames: ['source'],
  buckets: [10, 30, 60, 120, 300, 600, 1200],
  registers: [registry],
});

export const recordsSynced = new Counter({
  name: 'worker_records_synced_total',
  help: 'Total number of records synced',
  labelNames: ['source', 'type'],
  registers: [registry],
});

// Report metrics
export const reportsGenerated = new Counter({
  name: 'worker_reports_generated_total',
  help: 'Total number of reports generated',
  labelNames: ['type', 'status'],
  registers: [registry],
});

// Error metrics
export const jobErrors = new Counter({
  name: 'worker_job_errors_total',
  help: 'Total number of job errors',
  labelNames: ['queue', 'error_type'],
  registers: [registry],
});

// Helper function to record job metrics
export function recordJobMetrics(
  queue: string,
  jobType: string,
  duration: number,
  status: 'success' | 'failure',
  error?: string
) {
  jobsProcessed.inc({ queue, status });
  jobDuration.observe({ queue, job_type: jobType }, duration);
  
  if (status === 'failure' && error) {
    jobErrors.inc({ queue, error_type: error });
  }
}