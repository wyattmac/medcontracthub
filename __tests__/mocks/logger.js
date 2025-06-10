// Mock for logging services

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
  child: jest.fn(() => createMockLogger())
})

module.exports = {
  logger: createMockLogger(),
  apiLogger: createMockLogger(),
  dbLogger: createMockLogger(),
  errorLogger: createMockLogger(),
  performanceLogger: createMockLogger()
}