import { register, Counter, Gauge, Histogram, Summary } from 'prom-client';

// WebSocket Connection Metrics
export const wsConnections = new Gauge({
  name: 'websocket_connections_total',
  help: 'Total number of active WebSocket connections',
  labelNames: ['status'],
});

export const wsConnectionsPerUser = new Gauge({
  name: 'websocket_connections_per_user',
  help: 'Number of connections per user',
  labelNames: ['userId'],
});

// Room Metrics
export const activeRooms = new Gauge({
  name: 'websocket_rooms_active',
  help: 'Number of active rooms',
  labelNames: ['type'],
});

export const roomParticipants = new Gauge({
  name: 'websocket_room_participants',
  help: 'Number of participants per room',
  labelNames: ['roomId', 'type'],
});

// Event Metrics
export const eventsReceived = new Counter({
  name: 'websocket_events_received_total',
  help: 'Total number of WebSocket events received',
  labelNames: ['event', 'status'],
});

export const eventsEmitted = new Counter({
  name: 'websocket_events_emitted_total',
  help: 'Total number of WebSocket events emitted',
  labelNames: ['event', 'broadcast'],
});

// Message Metrics
export const messageSize = new Histogram({
  name: 'websocket_message_size_bytes',
  help: 'Size of WebSocket messages in bytes',
  labelNames: ['direction', 'event'],
  buckets: [100, 1000, 10000, 100000, 1000000], // 100B, 1KB, 10KB, 100KB, 1MB
});

export const messageProcessingDuration = new Histogram({
  name: 'websocket_message_processing_duration_seconds',
  help: 'Time taken to process WebSocket messages',
  labelNames: ['event'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

// Kafka Consumer Metrics
export const kafkaMessagesConsumed = new Counter({
  name: 'kafka_messages_consumed_total',
  help: 'Total number of Kafka messages consumed',
  labelNames: ['topic', 'status'],
});

export const kafkaConsumerLag = new Gauge({
  name: 'kafka_consumer_lag',
  help: 'Kafka consumer lag',
  labelNames: ['topic', 'partition'],
});

// Authentication Metrics
export const authAttempts = new Counter({
  name: 'websocket_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status'],
});

export const authDuration = new Histogram({
  name: 'websocket_auth_duration_seconds',
  help: 'Time taken for authentication',
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

// Rate Limiting Metrics
export const rateLimitHits = new Counter({
  name: 'websocket_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['userId', 'limit_type'],
});

// Error Metrics
export const errors = new Counter({
  name: 'websocket_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'event'],
});

// Performance Metrics
export const broadcastDuration = new Histogram({
  name: 'websocket_broadcast_duration_seconds',
  help: 'Time taken to broadcast messages',
  labelNames: ['event', 'room_size'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
});

// Redis Operations
export const redisOperations = new Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'],
});

export const redisOperationDuration = new Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Time taken for Redis operations',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
});

// Session Metrics
export const activeSessions = new Gauge({
  name: 'websocket_sessions_active',
  help: 'Number of active sessions',
});

export const sessionDuration = new Summary({
  name: 'websocket_session_duration_seconds',
  help: 'Duration of WebSocket sessions',
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

// Initialize default metrics
register.setDefaultLabels({
  service: 'realtime-service',
});

// Export the registry for the metrics endpoint
export { register };