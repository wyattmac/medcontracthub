"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const event_consumer_1 = require("./consumers/event-consumer");
const health_server_1 = require("./api/health-server");
const metrics_1 = require("./monitoring/metrics");
const logger_1 = require("./utils/logger");
const config_1 = require("./config");
class AnalyticsService {
    eventConsumer;
    healthServer;
    metricsCollector;
    constructor() {
        this.eventConsumer = new event_consumer_1.EventConsumer();
        this.healthServer = new health_server_1.HealthServer();
        this.metricsCollector = metrics_1.MetricsCollector.getInstance();
    }
    async start() {
        logger_1.logger.info('Starting Analytics Service...');
        try {
            // Initialize metrics collection
            await this.metricsCollector.init();
            // Start health/metrics server
            await this.healthServer.start(config_1.config.port);
            // Start consuming events
            await this.eventConsumer.start();
            logger_1.logger.info('Analytics Service started successfully');
            // Graceful shutdown handlers
            this.setupShutdownHandlers();
        }
        catch (error) {
            logger_1.logger.error('Failed to start Analytics Service:', error);
            process.exit(1);
        }
    }
    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            logger_1.logger.info(`Received ${signal}, starting graceful shutdown...`);
            try {
                // Stop accepting new events
                await this.eventConsumer.stop();
                // Close health server
                await this.healthServer.stop();
                logger_1.logger.info('Graceful shutdown completed');
                process.exit(0);
            }
            catch (error) {
                logger_1.logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
    }
}
// Start the service
const service = new AnalyticsService();
service.start().catch((error) => {
    logger_1.logger.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map