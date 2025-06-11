import { config } from '../config';

describe('Configuration', () => {
  it('should load default configuration', () => {
    expect(config).toBeDefined();
    expect(config.port).toBe(8400);
    expect(config.environment).toBe('test');
    expect(config.jwt.secret).toBe('test-secret');
  });
  
  it('should have valid WebSocket configuration', () => {
    expect(config.websocket).toBeDefined();
    expect(config.websocket.pingInterval).toBeGreaterThan(0);
    expect(config.websocket.pingTimeout).toBeGreaterThan(0);
    expect(config.websocket.maxPayloadSize).toBeGreaterThan(0);
  });
  
  it('should have valid Redis configuration', () => {
    expect(config.redis).toBeDefined();
    expect(config.redis.host).toBeDefined();
    expect(config.redis.port).toBeGreaterThan(0);
    expect(config.redis.keyPrefix).toBe('realtime:');
  });
  
  it('should have valid Kafka configuration', () => {
    expect(config.kafka).toBeDefined();
    expect(config.kafka.brokers).toBeInstanceOf(Array);
    expect(config.kafka.clientId).toBe('realtime-service');
    expect(config.kafka.topics).toBeDefined();
  });
});