import express from 'express';
import { Kafka } from 'kafkajs';
import { createClient } from 'redis';
import CircuitBreaker from 'opossum';
import axios from 'axios';
import winston from 'winston';
import { register as prometheusRegister, Counter, Histogram, Gauge } from 'prom-client';
import rateLimit from 'express-rate-limit';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
});

const eventCounter = new Counter({
  name: 'events_processed_total',
  help: 'Total number of events processed',
  labelNames: ['event_type', 'status'],
});

const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['service'],
});

// Initialize services
const app = express();
const port = process.env.PORT || 8080;
const metricsPort = process.env.METRICS_PORT || 9090;

// Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL,
});

// Kafka setup
const kafka = new Kafka({
  clientId: 'integration-adapter',
  brokers: (process.env.KAFKA_BROKERS || '').split(','),
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'integration-adapter-group' });

// Circuit breakers for external services
const ocrServiceBreaker = new CircuitBreaker(
  async (data: any) => {
    const response = await axios.post(`${process.env.OCR_SERVICE_URL}/process`, data);
    return response.data;
  },
  {
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '5000'),
    errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '50'),
    resetTimeout: 30000,
  }
);

const appServiceBreaker = new CircuitBreaker(
  async (endpoint: string, data?: any) => {
    const response = await axios({
      method: data ? 'POST' : 'GET',
      url: `${process.env.APP_SERVICE_URL}${endpoint}`,
      data,
    });
    return response.data;
  },
  {
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '5000'),
    errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '50'),
    resetTimeout: 30000,
  }
);

// Update circuit breaker metrics
ocrServiceBreaker.on('open', () => {
  circuitBreakerState.set({ service: 'ocr' }, 1);
  logger.warn('OCR service circuit breaker opened');
});

ocrServiceBreaker.on('halfOpen', () => {
  circuitBreakerState.set({ service: 'ocr' }, 2);
});

ocrServiceBreaker.on('close', () => {
  circuitBreakerState.set({ service: 'ocr' }, 0);
  logger.info('OCR service circuit breaker closed');
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status: res.statusCode.toString() },
      duration
    );
  });
  next();
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await redisClient.ping();
    res.json({ status: 'ready', services: { redis: 'connected', kafka: 'connected' } });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Event publishing endpoint
app.post('/api/events', async (req, res) => {
  try {
    const { topic, event, data } = req.body;
    
    await producer.send({
      topic,
      messages: [
        {
          key: event,
          value: JSON.stringify({
            event,
            data,
            timestamp: new Date().toISOString(),
            source: 'integration-adapter',
          }),
        },
      ],
    });
    
    eventCounter.inc({ event_type: event, status: 'success' });
    logger.info(`Event published: ${event} to topic: ${topic}`);
    
    res.json({ success: true, message: 'Event published successfully' });
  } catch (error) {
    eventCounter.inc({ event_type: req.body.event || 'unknown', status: 'error' });
    logger.error('Error publishing event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// OCR processing endpoint with circuit breaker
app.post('/api/ocr/process', async (req, res) => {
  try {
    const result = await ocrServiceBreaker.fire(req.body);
    
    // Publish OCR completion event
    await producer.send({
      topic: 'ocr-events',
      messages: [
        {
          key: 'ocr.completed',
          value: JSON.stringify({
            event: 'ocr.completed',
            documentId: req.body.documentId,
            result,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    
    res.json(result);
  } catch (error) {
    if (error.code === 'EBREAKER') {
      logger.error('Circuit breaker open for OCR service');
      res.status(503).json({ error: 'OCR service temporarily unavailable' });
    } else {
      logger.error('OCR processing error:', error);
      res.status(500).json({ error: error.message });
    }
  }
});

// Cache management endpoints
app.get('/api/cache/:key', async (req, res) => {
  try {
    const value = await redisClient.get(req.params.key);
    if (value) {
      res.json({ value: JSON.parse(value), cached: true });
    } else {
      res.status(404).json({ error: 'Key not found' });
    }
  } catch (error) {
    logger.error('Cache get error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cache/:key', async (req, res) => {
  try {
    const { value, ttl = 3600 } = req.body;
    await redisClient.setEx(req.params.key, ttl, JSON.stringify(value));
    res.json({ success: true, message: 'Value cached successfully' });
  } catch (error) {
    logger.error('Cache set error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kafka event consumer
async function startConsumer() {
  await consumer.subscribe({ topics: ['app-events', 'ocr-events'], fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value?.toString() || '{}');
        logger.info(`Received event from ${topic}:`, event);
        
        // Route events to appropriate handlers
        switch (event.event) {
          case 'opportunity.created':
            await handleOpportunityCreated(event.data);
            break;
          case 'proposal.submitted':
            await handleProposalSubmitted(event.data);
            break;
          case 'ocr.requested':
            await handleOcrRequested(event.data);
            break;
          default:
            logger.warn(`Unhandled event type: ${event.event}`);
        }
        
        eventCounter.inc({ event_type: event.event, status: 'processed' });
      } catch (error) {
        logger.error('Error processing message:', error);
        eventCounter.inc({ event_type: 'unknown', status: 'error' });
      }
    },
  });
}

// Event handlers
async function handleOpportunityCreated(data: any) {
  // Cache opportunity data for quick access
  await redisClient.setEx(`opportunity:${data.id}`, 86400, JSON.stringify(data));
  logger.info(`Cached opportunity: ${data.id}`);
}

async function handleProposalSubmitted(data: any) {
  // Trigger notification or workflow
  logger.info(`Processing proposal submission: ${data.id}`);
}

async function handleOcrRequested(data: any) {
  // Forward to OCR service with circuit breaker
  try {
    await ocrServiceBreaker.fire(data);
  } catch (error) {
    logger.error('Failed to process OCR request:', error);
  }
}

// Metrics endpoint
const metricsApp = express();
metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheusRegister.contentType);
  res.end(await prometheusRegister.metrics());
});

// Start services
async function start() {
  try {
    // Connect to Redis
    await redisClient.connect();
    logger.info('Connected to Redis');
    
    // Connect to Kafka
    await producer.connect();
    await consumer.connect();
    logger.info('Connected to Kafka');
    
    // Start Kafka consumer
    await startConsumer();
    
    // Start HTTP servers
    app.listen(port, () => {
      logger.info(`Integration adapter listening on port ${port}`);
    });
    
    metricsApp.listen(metricsPort, () => {
      logger.info(`Metrics server listening on port ${metricsPort}`);
    });
  } catch (error) {
    logger.error('Failed to start integration adapter:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await producer.disconnect();
  await consumer.disconnect();
  await redisClient.disconnect();
  process.exit(0);
});

// Start the service
start();