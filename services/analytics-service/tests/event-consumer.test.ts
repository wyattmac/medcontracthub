import { EventConsumer } from '../src/consumers/event-consumer';
import { Kafka } from 'kafkajs';
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { MetricsCollector } from '../src/monitoring/metrics';
import { logger } from '../src/utils/logger';

// Mock dependencies
jest.mock('kafkajs');
jest.mock('@kafkajs/confluent-schema-registry');
jest.mock('../src/writers/clickhouse-writer');
jest.mock('../src/processors/event-processor');
jest.mock('../src/monitoring/metrics');
jest.mock('../src/utils/logger');

describe('EventConsumer', () => {
  let eventConsumer: EventConsumer;
  let mockKafkaConsumer: any;
  let mockKafkaProducer: any;
  let mockSchemaRegistry: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup Kafka mocks
    mockKafkaConsumer = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    mockKafkaProducer = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
    };

    const mockKafka = {
      consumer: jest.fn().mockReturnValue(mockKafkaConsumer),
      producer: jest.fn().mockReturnValue(mockKafkaProducer),
    };

    (Kafka as jest.MockedClass<typeof Kafka>).mockImplementation(() => mockKafka as any);

    // Setup Schema Registry mock
    mockSchemaRegistry = {
      decode: jest.fn(),
    };
    (SchemaRegistry as jest.MockedClass<typeof SchemaRegistry>).mockImplementation(() => mockSchemaRegistry);

    // Setup MetricsCollector mock
    const mockMetrics = {
      incrementCounter: jest.fn(),
      recordHistogram: jest.fn(),
      recordGauge: jest.fn(),
    };
    (MetricsCollector.getInstance as jest.Mock).mockReturnValue(mockMetrics);

    // Create instance
    eventConsumer = new EventConsumer();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('start', () => {
    it('should connect to Kafka and start consuming', async () => {
      await eventConsumer.start();

      expect(mockKafkaConsumer.connect).toHaveBeenCalled();
      expect(mockKafkaProducer.connect).toHaveBeenCalled();
      expect(mockKafkaConsumer.subscribe).toHaveBeenCalledWith({
        topics: expect.any(Array),
        fromBeginning: false,
      });
      expect(mockKafkaConsumer.run).toHaveBeenCalled();
    });

    it('should setup consumer event handlers', async () => {
      await eventConsumer.start();

      expect(mockKafkaConsumer.on).toHaveBeenCalledWith('consumer.heartbeat', expect.any(Function));
      expect(mockKafkaConsumer.on).toHaveBeenCalledWith('consumer.commit_offsets', expect.any(Function));
      expect(mockKafkaConsumer.on).toHaveBeenCalledWith('consumer.group_join', expect.any(Function));
      expect(mockKafkaConsumer.on).toHaveBeenCalledWith('consumer.disconnect', expect.any(Function));
    });

    it('should throw error if connection fails', async () => {
      mockKafkaConsumer.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(eventConsumer.start()).rejects.toThrow('Connection failed');
    });
  });

  describe('stop', () => {
    it('should disconnect gracefully', async () => {
      await eventConsumer.stop();

      expect(mockKafkaConsumer.disconnect).toHaveBeenCalled();
      expect(mockKafkaProducer.disconnect).toHaveBeenCalled();
    });

    it('should wait for in-flight messages', async () => {
      // Simulate processing messages
      const consumer = eventConsumer as any;
      consumer.processingCount = 2;

      const stopPromise = eventConsumer.stop();

      // Simulate messages completing
      setTimeout(() => {
        consumer.processingCount = 0;
      }, 100);

      await stopPromise;

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Waiting for 2 messages'));
    });
  });

  describe('message handling', () => {
    let mockMessage: any;
    let mockPayload: any;

    beforeEach(() => {
      mockMessage = {
        key: Buffer.from('test-key'),
        value: Buffer.from('{"eventId":"123","eventType":"test","timestamp":"2024-01-01T00:00:00Z"}'),
        timestamp: Date.now().toString(),
        offset: '100',
        headers: {},
      };

      mockPayload = {
        topic: 'test-topic',
        partition: 0,
        message: mockMessage,
        heartbeat: jest.fn().mockResolvedValue(undefined),
      };
    });

    it('should process valid messages successfully', async () => {
      mockSchemaRegistry.decode.mockResolvedValue({
        eventId: '123',
        eventType: 'test',
        timestamp: '2024-01-01T00:00:00Z',
      });

      const consumer = eventConsumer as any;
      await consumer.handleMessage(mockPayload);

      expect(mockSchemaRegistry.decode).toHaveBeenCalledWith(mockMessage.value);
    });

    it('should handle decode failures', async () => {
      mockSchemaRegistry.decode.mockRejectedValue(new Error('Decode failed'));

      const consumer = eventConsumer as any;
      await consumer.handleMessage(mockPayload);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to decode message'),
        expect.any(Object)
      );
    });

    it('should validate events and reject invalid ones', async () => {
      mockSchemaRegistry.decode.mockResolvedValue({
        // Missing required fields
        eventType: 'test',
      });

      const consumer = eventConsumer as any;
      await consumer.handleMessage(mockPayload);

      expect(mockKafkaProducer.send).toHaveBeenCalledWith({
        topic: 'test-topic.dlq',
        messages: expect.any(Array),
      });
    });

    it('should send failed messages to DLQ', async () => {
      mockSchemaRegistry.decode.mockResolvedValue({
        eventId: '123',
        eventType: 'test',
        timestamp: '2024-01-01T00:00:00Z',
      });

      // Force processing error
      const consumer = eventConsumer as any;
      consumer.processor = {
        processEvent: jest.fn().mockRejectedValue(new Error('Processing failed')),
      };

      await consumer.handleMessage(mockPayload);

      expect(mockKafkaProducer.send).toHaveBeenCalledWith({
        topic: 'test-topic.dlq',
        messages: [{
          key: mockMessage.key,
          value: expect.stringContaining('Processing failed'),
          headers: expect.objectContaining({
            'dlq-reason': 'Processing failed',
            'original-topic': 'test-topic',
          }),
        }],
      });
    });

    it('should handle processing timeouts', async () => {
      jest.useFakeTimers();

      mockSchemaRegistry.decode.mockResolvedValue({
        eventId: '123',
        eventType: 'test',
        timestamp: '2024-01-01T00:00:00Z',
      });

      const consumer = eventConsumer as any;
      consumer.processor = {
        processEvent: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 60000))
        ),
      };

      const handlePromise = consumer.handleMessage(mockPayload);

      jest.advanceTimersByTime(31000); // Advance past timeout

      await handlePromise;

      expect(logger.warn).toHaveBeenCalledWith(
        'Processing timeout detected',
        expect.any(Object)
      );

      jest.useRealTimers();
    });

    it('should track metrics for processed messages', async () => {
      mockSchemaRegistry.decode.mockResolvedValue({
        eventId: '123',
        eventType: 'test',
        timestamp: '2024-01-01T00:00:00Z',
      });

      const mockMetrics = MetricsCollector.getInstance();
      const consumer = eventConsumer as any;
      consumer.processor = {
        processEvent: jest.fn().mockResolvedValue(undefined),
      };

      await consumer.handleMessage(mockPayload);

      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        'events_consumed_total',
        { topic: 'test-topic' }
      );
      expect(mockMetrics.recordHistogram).toHaveBeenCalledWith(
        'event_processing_duration_ms',
        expect.any(Number),
        { topic: 'test-topic' }
      );
      expect(mockMetrics.recordHistogram).toHaveBeenCalledWith(
        'event_lag_ms',
        expect.any(Number),
        { topic: 'test-topic' }
      );
    });

    it('should detect and log old messages', async () => {
      mockMessage.timestamp = (Date.now() - 400000).toString(); // 6+ minutes old

      mockSchemaRegistry.decode.mockResolvedValue({
        eventId: '123',
        eventType: 'test',
        timestamp: '2024-01-01T00:00:00Z',
      });

      const consumer = eventConsumer as any;
      consumer.processor = {
        processEvent: jest.fn().mockResolvedValue(undefined),
      };

      await consumer.handleMessage(mockPayload);

      expect(logger.warn).toHaveBeenCalledWith(
        'Processing old message',
        expect.objectContaining({
          ageMs: expect.any(Number),
        })
      );
    });
  });

  describe('health monitoring', () => {
    it('should detect heartbeat timeouts', () => {
      jest.useFakeTimers();

      const consumer = eventConsumer as any;
      consumer.lastHeartbeat = Date.now() - 70000; // 70 seconds ago

      consumer.startHealthMonitor();

      jest.advanceTimersByTime(31000);

      expect(logger.error).toHaveBeenCalledWith(
        'Consumer heartbeat timeout',
        expect.any(Object)
      );

      jest.useRealTimers();
    });
  });

  describe('graceful shutdown', () => {
    it('should handle SIGTERM signal', () => {
      const stopSpy = jest.spyOn(eventConsumer, 'stop').mockResolvedValue(undefined);
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Trigger setupShutdownHandlers
      const consumer = new EventConsumer();

      // Emit SIGTERM
      process.emit('SIGTERM');

      // Allow async operations to complete
      setImmediate(() => {
        expect(stopSpy).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(0);
      });
    });
  });
});