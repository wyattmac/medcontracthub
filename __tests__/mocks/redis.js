// Mock for Redis client

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  setex: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  lpush: jest.fn(),
  rpop: jest.fn(),
  setnx: jest.fn(),
  publish: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn(),
  on: jest.fn(),
  pipeline: jest.fn(() => ({
    exec: jest.fn().mockResolvedValue([])
  }))
}

const redis = {
  client: jest.fn(() => mockRedisClient),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
  hget: jest.fn().mockResolvedValue(null),
  hset: jest.fn().mockResolvedValue(true),
  lpush: jest.fn().mockResolvedValue(1),
  rpop: jest.fn().mockResolvedValue(null),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(true),
  ttl: jest.fn().mockResolvedValue(-1),
  setnx: jest.fn().mockResolvedValue(true),
  pipeline: jest.fn(() => mockRedisClient.pipeline()),
  publish: jest.fn().mockResolvedValue(0),
  getJSON: jest.fn().mockResolvedValue(null),
  setJSON: jest.fn().mockResolvedValue(true),
}

module.exports = {
  redisClient: mockRedisClient,
  isRedisAvailable: jest.fn(() => false),
  getRedisClient: jest.fn(() => null),
  closeRedisConnection: jest.fn().mockResolvedValue(undefined),
  checkRedisHealth: jest.fn().mockResolvedValue(false),
  redis
}