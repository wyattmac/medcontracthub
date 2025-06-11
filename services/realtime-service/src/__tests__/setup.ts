// Test setup file
import { config } from '../config';

// Mock Redis
jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    sadd: jest.fn(),
    srem: jest.fn(),
    duplicate: jest.fn().mockReturnThis(),
    on: jest.fn(),
    options: { keyPrefix: 'test:' },
  }));
  return RedisMock;
});

// Mock Kafka
jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    consumer: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      run: jest.fn(),
    }),
  })),
}));

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

// Increase test timeout
jest.setTimeout(30000);