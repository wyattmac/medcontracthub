import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const configSchema = z.object({
  port: z.number().default(8400),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  cors: z.object({
    origins: z.array(z.string()).default(['http://localhost:3000']),
    credentials: z.boolean().default(true),
  }),
  jwt: z.object({
    secret: z.string(),
    issuer: z.string().default('medcontracthub'),
    audience: z.string().default('medcontracthub-realtime'),
  }),
  redis: z.object({
    host: z.string().default('redis'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(2),
    keyPrefix: z.string().default('realtime:'),
  }),
  kafka: z.object({
    brokers: z.array(z.string()).default(['kafka:9092']),
    clientId: z.string().default('realtime-service'),
    groupId: z.string().default('realtime-service-group'),
    topics: z.object({
      notifications: z.string().default('notifications'),
      proposals: z.string().default('proposal-updates'),
      opportunities: z.string().default('opportunity-updates'),
      compliance: z.string().default('compliance-updates'),
      analytics: z.string().default('analytics-events'),
    }),
  }),
  websocket: z.object({
    pingInterval: z.number().default(25000),
    pingTimeout: z.number().default(5000),
    maxPayloadSize: z.number().default(10 * 1024 * 1024), // 10MB
    transports: z.array(z.enum(['websocket', 'polling'])).default(['websocket', 'polling']),
  }),
  monitoring: z.object({
    metricsPort: z.number().default(9090),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
  rateLimit: z.object({
    windowMs: z.number().default(60000), // 1 minute
    maxConnections: z.number().default(5),
    maxEventsPerMinute: z.number().default(100),
  }),
});

// Parse and validate configuration
const parseConfig = () => {
  try {
    return configSchema.parse({
      port: parseInt(process.env.REALTIME_PORT || '8400', 10),
      environment: process.env.NODE_ENV || 'development',
      cors: {
        origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
      },
      jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret-key',
        issuer: process.env.JWT_ISSUER || 'medcontracthub',
        audience: process.env.JWT_AUDIENCE || 'medcontracthub-realtime',
      },
      redis: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '2', 10),
        keyPrefix: 'realtime:',
      },
      kafka: {
        brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'],
        clientId: 'realtime-service',
        groupId: 'realtime-service-group',
        topics: {
          notifications: 'notifications',
          proposals: 'proposal-updates',
          opportunities: 'opportunity-updates',
          compliance: 'compliance-updates',
          analytics: 'analytics-events',
        },
      },
      websocket: {
        pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
        pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '5000', 10),
        maxPayloadSize: parseInt(process.env.WS_MAX_PAYLOAD || '10485760', 10),
        transports: ['websocket', 'polling'],
      },
      monitoring: {
        metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
        logLevel: (process.env.LOG_LEVEL || 'info') as any,
      },
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
        maxConnections: parseInt(process.env.MAX_CONNECTIONS || '5', 10),
        maxEventsPerMinute: parseInt(process.env.MAX_EVENTS_PER_MINUTE || '100', 10),
      },
    });
  } catch (error) {
    console.error('Configuration validation failed:', error);
    throw error;
  }
};

export const config = parseConfig();
export type Config = z.infer<typeof configSchema>;