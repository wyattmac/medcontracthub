// Test setup file
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock logger to reduce noise in tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Global test timeout
jest.setTimeout(30000);

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});