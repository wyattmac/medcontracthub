import { Kafka, Consumer, EachMessagePayload, KafkaMessage } from 'kafkajs';
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { ClickHouseWriter } from '../writers/clickhouse-writer';
import { EventProcessor } from '../processors/event-processor';
import { MetricsCollector } from '../monitoring/metrics';
import { logger } from '../utils/logger';
import { config } from '../config';

export class EventConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private registry: SchemaRegistry;
  private clickhouseWriter: ClickHouseWriter;
  private processor: EventProcessor;
  private metrics: MetricsCollector;
  private isRunning = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: config.kafka.consumerGroup,
      sessionTimeout: config.kafka.sessionTimeout,
      rebalanceTimeout: config.kafka.rebalanceTimeout,
      heartbeatInterval: 3000,
    });

    this.registry = new SchemaRegistry({
      host: config.schemaRegistry.url,
    });

    this.clickhouseWriter = new ClickHouseWriter();
    this.processor = new EventProcessor(this.clickhouseWriter);
    this.metrics = MetricsCollector.getInstance();
  }

  async start(): Promise<void> {
    logger.info('Starting Kafka consumer...');

    try {
      // Connect to Kafka
      await this.consumer.connect();
      
      // Subscribe to topics
      await this.consumer.subscribe({
        topics: config.kafka.topics,
        fromBeginning: false,
      });

      this.isRunning = true;

      // Start consuming
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });

      logger.info('Kafka consumer started successfully');
    } catch (error) {
      logger.error('Failed to start Kafka consumer:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping Kafka consumer...');
    this.isRunning = false;

    try {
      // Flush any pending writes
      await this.processor.flush();
      
      // Disconnect from Kafka
      await this.consumer.disconnect();
      
      logger.info('Kafka consumer stopped successfully');
    } catch (error) {
      logger.error('Error stopping Kafka consumer:', error);
      throw error;
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const startTime = Date.now();

    try {
      // Track message consumption
      this.metrics.incrementCounter('events_consumed_total', { topic });

      // Decode message
      const event = await this.decodeMessage(topic, message);
      
      if (!event) {
        logger.warn('Failed to decode message', { topic, partition });
        return;
      }

      // Process event based on type
      await this.processor.processEvent(topic, event);

      // Track processing time
      const duration = Date.now() - startTime;
      this.metrics.recordHistogram('event_processing_duration_ms', duration, { topic });

      // Log successful processing
      logger.debug('Event processed successfully', {
        topic,
        partition,
        offset: message.offset,
        eventId: event.eventId,
        duration,
      });

    } catch (error) {
      logger.error('Error processing message', {
        topic,
        partition,
        offset: message.offset,
        error,
      });

      // Track errors
      this.metrics.incrementCounter('events_processing_errors_total', { topic });

      // In production, send to DLQ
      await this.sendToDLQ(topic, message, error as Error);
    }
  }

  private async decodeMessage(topic: string, message: KafkaMessage): Promise<any> {
    try {
      if (!message.value) {
        return null;
      }

      // Try to decode with schema registry
      try {
        const decoded = await this.registry.decode(message.value);
        return decoded;
      } catch (schemaError) {
        // Fallback to JSON parsing for backwards compatibility
        const jsonString = message.value.toString();
        return JSON.parse(jsonString);
      }
    } catch (error) {
      logger.error('Failed to decode message', { topic, error });
      return null;
    }
  }

  private async sendToDLQ(topic: string, message: KafkaMessage, error: Error): Promise<void> {
    // In a real implementation, produce to DLQ topic
    logger.error('Message sent to DLQ', {
      originalTopic: topic,
      offset: message.offset,
      error: error.message,
    });
  }
}