import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const configSchema = z.object({
  env: z.enum(['development', 'staging', 'production']).default('development'),
  port: z.number().default(8300),
  
  // Kafka configuration
  kafka: z.object({
    brokers: z.array(z.string()).default(['kafka:9092']),
    clientId: z.string().default('analytics-service'),
    consumerGroup: z.string().default('analytics-consumer-group'),
    topics: z.array(z.string()).default([
      'contracts.opportunity.viewed',
      'contracts.opportunity.saved',
      'contracts.proposal.created',
      'contracts.proposal.updated',
      'ai.document.processed',
      'user.activity',
    ]),
    sessionTimeout: z.number().default(30000),
    rebalanceTimeout: z.number().default(60000),
  }),
  
  // Schema Registry
  schemaRegistry: z.object({
    url: z.string().default('http://schema-registry:8081'),
  }),
  
  // ClickHouse configuration
  clickhouse: z.object({
    host: z.string().default('clickhouse'),
    port: z.number().default(8123),
    database: z.string().default('medcontract_analytics'),
    username: z.string().default('default'),
    password: z.string().default(''),
    requestTimeout: z.number().default(30000),
  }),
  
  // Redis configuration (for caching)
  redis: z.object({
    host: z.string().default('redis-cluster'),
    port: z.number().default(6379),
    ttl: z.number().default(300), // 5 minutes
  }),
  
  // Processing configuration
  processing: z.object({
    batchSize: z.number().default(1000),
    flushIntervalMs: z.number().default(5000),
    maxConcurrentQueries: z.number().default(10),
    retryAttempts: z.number().default(3),
    retryDelayMs: z.number().default(1000),
  }),
  
  // Monitoring
  monitoring: z.object({
    metricsPort: z.number().default(9090),
    healthCheckIntervalMs: z.number().default(30000),
  }),
  
  // SLOs
  slos: z.object({
    dataFreshnessMinutes: z.number().default(5),
    queryLatencyP99Ms: z.number().default(500),
    availabilityTarget: z.number().default(0.995),
  }),
});

// Parse and validate configuration
const parseConfig = () => {
  const env = {
    env: process.env['NODE_ENV'],
    port: Number(process.env['PORT']) || undefined,
    
    kafka: {
      brokers: process.env['KAFKA_BROKERS']?.split(','),
      clientId: process.env['KAFKA_CLIENT_ID'],
      consumerGroup: process.env['KAFKA_CONSUMER_GROUP'],
      topics: process.env['KAFKA_TOPICS']?.split(','),
    },
    
    schemaRegistry: {
      url: process.env['SCHEMA_REGISTRY_URL'],
    },
    
    clickhouse: {
      host: process.env['CLICKHOUSE_HOST'],
      port: Number(process.env['CLICKHOUSE_PORT']) || undefined,
      database: process.env['CLICKHOUSE_DATABASE'],
      username: process.env['CLICKHOUSE_USERNAME'],
      password: process.env['CLICKHOUSE_PASSWORD'],
    },
    
    redis: {
      host: process.env['REDIS_HOST'],
      port: Number(process.env['REDIS_PORT']) || undefined,
    },
    
    processing: {
      batchSize: Number(process.env['BATCH_SIZE']) || undefined,
      flushIntervalMs: Number(process.env['FLUSH_INTERVAL_MS']) || undefined,
    },
    
    monitoring: {
      metricsPort: Number(process.env['METRICS_PORT']) || undefined,
    },
  };
  
  // Remove undefined values
  const cleanEnv = JSON.parse(JSON.stringify(env));
  
  return configSchema.parse(cleanEnv);
};

export const config = parseConfig();

// Log configuration (without sensitive data)
console.log('Analytics Service Configuration:', {
  env: config.env,
  port: config.port,
  kafka: {
    brokers: config.kafka.brokers,
    topics: config.kafka.topics,
  },
  clickhouse: {
    host: config.clickhouse.host,
    database: config.clickhouse.database,
  },
});