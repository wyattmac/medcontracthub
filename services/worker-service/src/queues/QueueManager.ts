import { Queue, Worker, QueueScheduler, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { activeJobs, queueSize } from '../utils/metrics';

export interface QueueConfig {
  name: string;
  concurrency: number;
  defaultJobOptions?: any;
}

export class QueueManager {
  private connection: IORedis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private schedulers: Map<string, QueueScheduler> = new Map();
  private events: Map<string, QueueEvents> = new Map();

  constructor() {
    this.connection = new IORedis(config.redis.url, {
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      enableReadyCheck: config.redis.enableReadyCheck,
      password: config.redis.password,
    });

    this.connection.on('connect', () => {
      logger.info('Redis connected for queue management');
    });

    this.connection.on('error', (error) => {
      logger.error({ error }, 'Redis connection error');
    });
  }

  createQueue(queueConfig: QueueConfig): Queue {
    const { name, defaultJobOptions } = queueConfig;

    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      connection: this.connection.duplicate(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        ...defaultJobOptions,
      },
    });

    // Create scheduler for delayed jobs
    const scheduler = new QueueScheduler(name, {
      connection: this.connection.duplicate(),
    });

    // Create events listener for monitoring
    const events = new QueueEvents(name, {
      connection: this.connection.duplicate(),
    });

    // Monitor queue metrics
    this.setupQueueMonitoring(name, queue, events);

    this.queues.set(name, queue);
    this.schedulers.set(name, scheduler);
    this.events.set(name, events);

    logger.info({ queue: name }, 'Queue created');
    return queue;
  }

  createWorker(
    queueConfig: QueueConfig,
    processor: (job: any) => Promise<any>
  ): Worker {
    const { name, concurrency } = queueConfig;

    if (this.workers.has(name)) {
      throw new Error(`Worker already exists for queue: ${name}`);
    }

    const worker = new Worker(name, processor, {
      connection: this.connection.duplicate(),
      concurrency,
      autorun: true,
    });

    worker.on('completed', (job) => {
      logger.info({ 
        queue: name, 
        jobId: job.id,
        jobName: job.name,
      }, 'Job completed');
    });

    worker.on('failed', (job, error) => {
      logger.error({ 
        queue: name, 
        jobId: job?.id,
        jobName: job?.name,
        error: error.message,
        stack: error.stack,
      }, 'Job failed');
    });

    worker.on('error', (error) => {
      logger.error({ 
        queue: name, 
        error: error.message,
        stack: error.stack,
      }, 'Worker error');
    });

    this.workers.set(name, worker);
    logger.info({ queue: name, concurrency }, 'Worker created');
    return worker;
  }

  private async setupQueueMonitoring(
    name: string, 
    queue: Queue, 
    events: QueueEvents
  ): Promise<void> {
    // Update metrics periodically
    setInterval(async () => {
      try {
        const counts = await queue.getJobCounts();
        queueSize.set({ queue: name }, counts.waiting + counts.delayed);
        activeJobs.set({ queue: name }, counts.active);
      } catch (error) {
        logger.error({ error, queue: name }, 'Failed to update queue metrics');
      }
    }, 5000); // Update every 5 seconds

    // Monitor job events
    events.on('completed', ({ jobId }) => {
      logger.debug({ queue: name, jobId }, 'Job completed event');
    });

    events.on('failed', ({ jobId, failedReason }) => {
      logger.warn({ queue: name, jobId, failedReason }, 'Job failed event');
    });

    events.on('stalled', ({ jobId }) => {
      logger.warn({ queue: name, jobId }, 'Job stalled');
    });
  }

  async addJob(
    queueName: string, 
    jobName: string, 
    data: any, 
    options?: any
  ): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const job = await queue.add(jobName, data, options);
    logger.info({ 
      queue: queueName, 
      jobName, 
      jobId: job.id 
    }, 'Job added to queue');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down queue manager...');

    // Close workers first
    for (const [name, worker] of this.workers) {
      logger.info({ queue: name }, 'Closing worker...');
      await worker.close();
    }

    // Close schedulers
    for (const [name, scheduler] of this.schedulers) {
      logger.info({ queue: name }, 'Closing scheduler...');
      await scheduler.close();
    }

    // Close event listeners
    for (const [name, events] of this.events) {
      logger.info({ queue: name }, 'Closing events...');
      await events.close();
    }

    // Close queues
    for (const [name, queue] of this.queues) {
      logger.info({ queue: name }, 'Closing queue...');
      await queue.close();
    }

    // Close Redis connection
    this.connection.disconnect();
    logger.info('Queue manager shutdown complete');
  }

  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  getWorker(name: string): Worker | undefined {
    return this.workers.get(name);
  }
}