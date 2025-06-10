// Mock for caching utilities

class MemoryCache {
  constructor() {
    this.cache = new Map()
  }
  
  get(key) {
    return this.cache.get(key)
  }
  
  set(key, value, ttl) {
    this.cache.set(key, value)
  }
  
  has(key) {
    return this.cache.has(key)
  }
  
  delete(key) {
    return this.cache.delete(key)
  }
  
  clear() {
    this.cache.clear()
  }
}

const createMockCache = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  has: jest.fn().mockResolvedValue(false),
  delete: jest.fn().mockResolvedValue(true),
  clear: jest.fn().mockResolvedValue(true),
  wrap: jest.fn((key, fn) => fn()),
  invalidate: jest.fn().mockResolvedValue(true)
})

module.exports = {
  searchCache: createMockCache(),
  apiCache: createMockCache(),
  MemoryCache,
  createCacheKey: jest.fn((params) => JSON.stringify(params)),
  CacheService: jest.fn().mockImplementation(() => createMockCache())
}