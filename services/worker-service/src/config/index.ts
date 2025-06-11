import { z } from 'zod';

const configSchema = z.object({
  // Service configuration
  service: z.object({
    name: z.string().default('worker-service'),
    port: z.number().default(8500),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
  }),

  // Redis configuration
  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
    maxRetriesPerRequest: z.number().default(3),
    enableReadyCheck: z.boolean().default(true),
    password: z.string().optional(),
  }),

  // Kafka configuration
  kafka: z.object({
    brokers: z.array(z.string()).default(['localhost:9092']),
    clientId: z.string().default('worker-service'),
    groupId: z.string().default('worker-service-group'),
    ssl: z.boolean().default(false),
    sasl: z.object({
      mechanism: z.enum(['plain', 'scram-sha-256', 'scram-sha-512']).optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    }).optional(),
  }),

  // Queue configuration
  queues: z.object({
    email: z.object({
      concurrency: z.number().default(5),
      defaultJobOptions: z.object({
        attempts: z.number().default(3),
        backoff: z.object({
          type: z.enum(['exponential', 'fixed']).default('exponential'),
          delay: z.number().default(5000),
        }),
        removeOnComplete: z.boolean().default(true),
        removeOnFail: z.boolean().default(false),
      }),
    }),
    document: z.object({
      concurrency: z.number().default(3),
      defaultJobOptions: z.object({
        attempts: z.number().default(3),
        timeout: z.number().default(300000), // 5 minutes
        backoff: z.object({
          type: z.enum(['exponential', 'fixed']).default('exponential'),
          delay: z.number().default(10000),
        }),
      }),
    }),
    sync: z.object({
      concurrency: z.number().default(1),
      defaultJobOptions: z.object({
        attempts: z.number().default(3),
        timeout: z.number().default(600000), // 10 minutes
      }),
    }),
    report: z.object({
      concurrency: z.number().default(2),
      defaultJobOptions: z.object({
        attempts: z.number().default(2),
        timeout: z.number().default(180000), // 3 minutes
      }),
    }),
  }),

  // Email configuration
  email: z.object({
    provider: z.enum(['sendgrid', 'smtp', 'console']).default('console'),
    from: z.string().default('noreply@medcontracthub.com'),
    sendgrid: z.object({
      apiKey: z.string().optional(),
    }),
    smtp: z.object({
      host: z.string().optional(),
      port: z.number().optional(),
      secure: z.boolean().optional(),
      auth: z.object({
        user: z.string().optional(),
        pass: z.string().optional(),
      }).optional(),
    }),
  }),

  // Database configuration
  database: z.object({
    supabaseUrl: z.string(),
    supabaseServiceKey: z.string(),
  }),

  // SAM.gov configuration
  samGov: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().default('https://api.sam.gov'),
    syncIntervalMinutes: z.number().default(60),
    maxConcurrentRequests: z.number().default(5),
    requestDelayMs: z.number().default(1000),
  }),

  // Scheduled jobs
  scheduledJobs: z.object({
    emailReminders: z.object({
      enabled: z.boolean().default(true),
      cron: z.string().default('0 9 * * *'), // Daily at 9 AM
    }),
    samGovSync: z.object({
      enabled: z.boolean().default(true),
      cron: z.string().default('0 */6 * * *'), // Every 6 hours
    }),
    dataCleanup: z.object({
      enabled: z.boolean().default(true),
      cron: z.string().default('0 2 * * *'), // Daily at 2 AM
      retentionDays: z.number().default(90),
    }),
    reportGeneration: z.object({
      enabled: z.boolean().default(true),
      cron: z.string().default('0 8 * * MON'), // Weekly on Monday at 8 AM
    }),
  }),

  // Monitoring
  monitoring: z.object({
    sentryDsn: z.string().optional(),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
});

// Load configuration from environment
const loadConfig = () => {
  const env = process.env;

  return configSchema.parse({
    service: {
      name: env['SERVICE_NAME'],
      port: env['PORT'] ? parseInt(env['PORT'], 10) : undefined,
      environment: env['NODE_ENV'],
    },
    redis: {
      url: env['REDIS_URL'],
      password: env['REDIS_PASSWORD'],
    },
    kafka: {
      brokers: env['KAFKA_BROKERS']?.split(','),
      clientId: env['KAFKA_CLIENT_ID'],
      groupId: env['KAFKA_GROUP_ID'],
      ssl: env['KAFKA_SSL'] === 'true',
      sasl: env['KAFKA_SASL_USERNAME'] ? {
        mechanism: 'plain' as const,
        username: env['KAFKA_SASL_USERNAME'],
        password: env['KAFKA_SASL_PASSWORD'],
      } : undefined,
    },
    database: {
      supabaseUrl: env['SUPABASE_URL'] || '',
      supabaseServiceKey: env['SUPABASE_SERVICE_ROLE_KEY'] || '',
    },
    email: {
      provider: (env['EMAIL_PROVIDER'] as any) || 'console',
      from: env['EMAIL_FROM'],
      sendgrid: {
        apiKey: env['SENDGRID_API_KEY'],
      },
      smtp: {
        host: env['SMTP_HOST'],
        port: env['SMTP_PORT'] ? parseInt(env['SMTP_PORT'], 10) : undefined,
        secure: env['SMTP_SECURE'] === 'true',
        auth: env['SMTP_USER'] ? {
          user: env['SMTP_USER'],
          pass: env['SMTP_PASS'],
        } : undefined,
      },
    },
    samGov: {
      apiKey: env['SAM_GOV_API_KEY'],
      baseUrl: env['SAM_GOV_BASE_URL'],
      syncIntervalMinutes: env['SAM_SYNC_INTERVAL'] ? parseInt(env['SAM_SYNC_INTERVAL'], 10) : undefined,
    },
    monitoring: {
      sentryDsn: env['SENTRY_DSN'],
      logLevel: (env['LOG_LEVEL'] as any) || 'info',
    },
  });
};

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;