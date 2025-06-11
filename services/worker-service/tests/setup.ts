import { config } from '@jest/types';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.SERVICE_NAME = 'worker-service-test';
process.env.PORT = '8501';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.EMAIL_PROVIDER = 'console';
process.env.LOG_LEVEL = 'error';

// Mock Redis
jest.mock('ioredis', () => {
  const Redis = jest.requireActual('ioredis-mock');
  return Redis;
});

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: [],
          error: null,
        })),
      })),
      insert: jest.fn(() => ({
        error: null,
      })),
      upsert: jest.fn(() => ({
        error: null,
      })),
    })),
    auth: {
      getUser: jest.fn(() => ({
        data: { user: { id: 'test-user' } },
        error: null,
      })),
    },
  })),
}));

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(() => Promise.resolve()),
}));

// Mock Sentry
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  close: jest.fn(() => Promise.resolve()),
}));

// Set test timeout
jest.setTimeout(30000);