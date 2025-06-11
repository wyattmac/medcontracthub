import express from 'express';
import { register } from 'prom-client';
import * as Sentry from '@sentry/node';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import { logger } from './utils/logger';
import { registry } from './utils/metrics';
import { QueueManager } from './queues/QueueManager';
import { SchedulerService } from './services/SchedulerService';
import { processEmailJob } from './jobs/emailProcessor';
import { processDocumentJob } from './jobs/documentProcessor';
import { processSyncJob } from './jobs/dataSync';

// Initialize Sentry
if (config.monitoring.sentryDsn) {
  Sentry.init({
    dsn: config.monitoring.sentryDsn,
    environment: config.service.environment,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],
    tracesSampleRate: config.service.environment === 'production' ? 0.1 : 1.0,
  });
}

async function startWorkerService() {
  logger.info({ config: config.service }, 'Starting Worker Service...');

  // Initialize Express app for health checks and metrics
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: config.service.name,
      environment: config.service.environment,
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness check
  app.get('/ready', async (req, res) => {
    try {
      // Check Redis connection
      const queueManager = new QueueManager();
      const emailQueue = queueManager.getQueue('email');
      if (!emailQueue) {
        throw new Error('Email queue not initialized');
      }

      res.json({
        status: 'ready',
        service: config.service.name,
      });
    } catch (error) {
      logger.error({ error }, 'Readiness check failed');
      res.status(503).json({
        status: 'not_ready',
        error: error,
      });
    }
  });

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await registry.metrics());
    } catch (error) {
      res.status(500).end(error);
    }
  });

  // Initialize queue manager
  const queueManager = new QueueManager();

  // Create queues
  const emailQueue = queueManager.createQueue({
    name: 'email',
    concurrency: config.queues.email.concurrency,
    defaultJobOptions: config.queues.email.defaultJobOptions,
  });

  const documentQueue = queueManager.createQueue({
    name: 'document',
    concurrency: config.queues.document.concurrency,
    defaultJobOptions: config.queues.document.defaultJobOptions,
  });

  const syncQueue = queueManager.createQueue({
    name: 'sync',
    concurrency: config.queues.sync.concurrency,
    defaultJobOptions: config.queues.sync.defaultJobOptions,
  });

  const reportQueue = queueManager.createQueue({
    name: 'report',
    concurrency: config.queues.report.concurrency,
    defaultJobOptions: config.queues.report.defaultJobOptions,
  });

  // Create workers
  queueManager.createWorker(
    {
      name: 'email',
      concurrency: config.queues.email.concurrency,
      defaultJobOptions: config.queues.email.defaultJobOptions,
    },
    processEmailJob
  );

  queueManager.createWorker(
    {
      name: 'document',
      concurrency: config.queues.document.concurrency,
      defaultJobOptions: config.queues.document.defaultJobOptions,
    },
    processDocumentJob
  );

  queueManager.createWorker(
    {
      name: 'sync',
      concurrency: config.queues.sync.concurrency,
      defaultJobOptions: config.queues.sync.defaultJobOptions,
    },
    processSyncJob
  );

  // Report queue uses document processor
  queueManager.createWorker(
    {
      name: 'report',
      concurrency: config.queues.report.concurrency,
      defaultJobOptions: config.queues.report.defaultJobOptions,
    },
    processDocumentJob
  );

  // Setup Bull Board for queue monitoring
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [
      new BullMQAdapter(emailQueue),
      new BullMQAdapter(documentQueue),
      new BullMQAdapter(syncQueue),
      new BullMQAdapter(reportQueue),
    ],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  // Initialize scheduler
  const scheduler = new SchedulerService(queueManager);
  await scheduler.start();

  // Start Express server
  const server = app.listen(config.service.port, () => {
    logger.info(
      { 
        port: config.service.port,
        bullBoard: `http://localhost:${config.service.port}/admin/queues`,
      },
      'Worker Service started successfully'
    );
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop scheduler
    scheduler.stop();

    // Shutdown queue manager
    await queueManager.shutdown();

    // Close Sentry
    await Sentry.close(2000);

    logger.info('Worker Service shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    Sentry.captureException(error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled rejection');
    Sentry.captureException(reason);
    process.exit(1);
  });
}

// Start the service
startWorkerService().catch((error) => {
  logger.fatal({ error }, 'Failed to start Worker Service');
  process.exit(1);
});