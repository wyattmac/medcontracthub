import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { register } from './utils/metrics';
import { config } from './config';
import { createLogger } from './utils/logger';
import { WebSocketServer } from './services/WebSocketServer';
import { KafkaConsumerService } from './services/KafkaConsumer';
import { NotificationHandler } from './handlers/notificationHandler';

const logger = createLogger('main');

async function main() {
  try {
    logger.info('Starting Real-time Service...');
    
    // Create Express app
    const app = express();
    
    // Middleware
    app.use(helmet());
    app.use(cors(config.cors));
    app.use(express.json());
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'realtime-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });
    
    // Metrics endpoint
    app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });
    
    // Create HTTP server
    const httpServer = createServer(app);
    
    // Create Socket.IO server
    const io = new Server(httpServer, {
      cors: config.cors,
      pingInterval: config.websocket.pingInterval,
      pingTimeout: config.websocket.pingTimeout,
      maxHttpBufferSize: config.websocket.maxPayloadSize,
      transports: config.websocket.transports,
    });
    
    // Initialize WebSocket server
    const wsServer = new WebSocketServer(io);
    
    // Initialize notification handler
    const notificationHandler = new NotificationHandler(io);
    
    // Initialize and start Kafka consumer
    const kafkaConsumer = new KafkaConsumerService(io, notificationHandler);
    await kafkaConsumer.start();
    
    // Stats endpoint
    app.get('/stats', async (req, res) => {
      try {
        const stats = await wsServer.getStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });
    
    // Start metrics server
    const metricsApp = express();
    metricsApp.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });
    
    const metricsServer = metricsApp.listen(config.monitoring.metricsPort, () => {
      logger.info(`Metrics server listening on port ${config.monitoring.metricsPort}`);
    });
    
    // Start main server
    httpServer.listen(config.port, () => {
      logger.info({
        event: 'server_started',
        port: config.port,
        environment: config.environment,
      });
    });
    
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      // Stop accepting new connections
      io.close(() => {
        logger.info('WebSocket server closed');
      });
      
      // Stop Kafka consumer
      await kafkaConsumer.stop();
      
      // Close HTTP servers
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });
      
      metricsServer.close(() => {
        logger.info('Metrics server closed');
      });
      
      // Wait for existing connections to close
      setTimeout(() => {
        logger.info('Forcing shutdown');
        process.exit(0);
      }, 10000);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error({
        event: 'uncaught_exception',
        error,
      });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error({
        event: 'unhandled_rejection',
        reason,
        promise,
      });
    });
    
  } catch (error) {
    logger.error({
      event: 'startup_error',
      error,
    });
    process.exit(1);
  }
}

// Start the service
main();