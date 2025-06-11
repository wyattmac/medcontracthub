import { AuthenticatedSocket } from '../types';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { rateLimitHits } from '../utils/metrics';
import Redis from 'ioredis';

const logger = createLogger('rate-limiter');

export class RateLimiter {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  async checkConnection(userId: string): Promise<boolean> {
    const key = `${config.redis.keyPrefix}connections:${userId}`;
    const connections = await this.redis.incr(key);
    
    if (connections === 1) {
      await this.redis.expire(key, config.rateLimit.windowMs / 1000);
    }
    
    if (connections > config.rateLimit.maxConnections) {
      rateLimitHits.inc({ userId, limit_type: 'connections' });
      logger.warn({
        event: 'rate_limit_exceeded',
        userId,
        type: 'connections',
        limit: config.rateLimit.maxConnections,
        current: connections,
      });
      return false;
    }
    
    return true;
  }
  
  async releaseConnection(userId: string): Promise<void> {
    const key = `${config.redis.keyPrefix}connections:${userId}`;
    await this.redis.decr(key);
  }
  
  async checkEventRate(userId: string, event: string): Promise<boolean> {
    const key = `${config.redis.keyPrefix}events:${userId}:${event}`;
    const count = await this.redis.incr(key);
    
    if (count === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }
    
    if (count > config.rateLimit.maxEventsPerMinute) {
      rateLimitHits.inc({ userId, limit_type: 'events' });
      logger.warn({
        event: 'rate_limit_exceeded',
        userId,
        type: 'events',
        eventName: event,
        limit: config.rateLimit.maxEventsPerMinute,
        current: count,
      });
      return false;
    }
    
    return true;
  }
  
  middleware() {
    const limiterMap = new Map<string, number>();
    
    return async (socket: AuthenticatedSocket, [event]: any[], next: (err?: Error) => void) => {
      if (!socket.userId) {
        return next();
      }
      
      // Check event rate
      const allowed = await this.checkEventRate(socket.userId, event);
      if (!allowed) {
        return next(new Error('Rate limit exceeded'));
      }
      
      next();
    };
  }
}