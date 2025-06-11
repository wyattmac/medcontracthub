import { EventConsumer } from './consumers/event-consumer';
import { HealthServer } from './api/health-server';
import { MetricsCollector } from './monitoring/metrics';
import { logger } from './utils/logger';
import { config } from './config';

class AnalyticsService {
  private eventConsumer: EventConsumer;
  private healthServer: HealthServer;
  private metricsCollector: MetricsCollector;

  constructor() {
    this.eventConsumer = new EventConsumer();
    this.healthServer = new HealthServer();
    this.metricsCollector = new MetricsCollector();
  }

  async start(): Promise<void> {
    logger.info('Starting Analytics Service...');

    try {
      // Initialize metrics collection
      await this.metricsCollector.init();
      
      // Start health/metrics server
      await this.healthServer.start(config.port);
      
      // Start consuming events
      await this.eventConsumer.start();
      
      logger.info('Analytics Service started successfully');

      // Graceful shutdown handlers
      this.setupShutdownHandlers();
    } catch (error) {
      logger.error('Failed to start Analytics Service:', error);
      process.exit(1);
    }
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        // Stop accepting new events
        await this.eventConsumer.stop();
        
        // Close health server
        await this.healthServer.stop();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }
}

// Start the service
const service = new AnalyticsService();
service.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});