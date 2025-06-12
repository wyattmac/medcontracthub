"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventConsumer = void 0;
const kafkajs_1 = require("kafkajs");
const confluent_schema_registry_1 = require("@kafkajs/confluent-schema-registry");
const clickhouse_writer_1 = require("../writers/clickhouse-writer");
const event_processor_1 = require("../processors/event-processor");
const metrics_1 = require("../monitoring/metrics");
const logger_1 = require("../utils/logger");
const config_1 = require("../config");
const perf_hooks_1 = require("perf_hooks");
class EventConsumer {
    kafka;
    consumer;
    producer;
    registry;
    clickhouseWriter;
    processor;
    metrics;
    isShuttingDown = false;
    processingCount = 0;
    lastHeartbeat = Date.now();
    constructor() {
        this.kafka = new kafkajs_1.Kafka({
            clientId: config_1.config.kafka.clientId,
            brokers: config_1.config.kafka.brokers,
            logLevel: kafkajs_1.logLevel.INFO,
            retry: {
                initialRetryTime: 100,
                retries: 8,
                multiplier: 2,
                maxRetryTime: 30000,
            },
            connectionTimeout: 10000,
            requestTimeout: 30000,
        });
        this.consumer = this.kafka.consumer({
            groupId: config_1.config.kafka.consumerGroup,
            sessionTimeout: config_1.config.kafka.sessionTimeout,
            rebalanceTimeout: config_1.config.kafka.rebalanceTimeout,
            heartbeatInterval: 3000,
            allowAutoTopicCreation: false,
            retry: {
                retries: 5,
            },
            maxBytesPerPartition: 1048576, // 1MB
            maxWaitTimeInMs: 100,
        });
        this.producer = this.kafka.producer({
            allowAutoTopicCreation: false,
            idempotent: true,
            maxInFlightRequests: 5,
            retry: {
                retries: 5,
            },
        });
        this.registry = new confluent_schema_registry_1.SchemaRegistry({
            host: config_1.config.schemaRegistry.url,
        });
        this.clickhouseWriter = new clickhouse_writer_1.ClickHouseWriter();
        this.processor = new event_processor_1.EventProcessor(this.clickhouseWriter);
        this.metrics = metrics_1.MetricsCollector.getInstance();
        // Set up graceful shutdown
        this.setupShutdownHandlers();
    }
    async start() {
        logger_1.logger.info('Starting Kafka consumer...');
        try {
            // Connect to Kafka
            await this.consumer.connect();
            await this.producer.connect();
            // Subscribe to topics
            await this.consumer.subscribe({
                topics: config_1.config.kafka.topics,
                fromBeginning: false,
            });
            // Set up consumer event handlers
            this.consumer.on('consumer.heartbeat', () => {
                this.lastHeartbeat = Date.now();
                logger_1.logger.debug('Consumer heartbeat');
            });
            this.consumer.on('consumer.commit_offsets', (event) => {
                logger_1.logger.debug('Offsets committed', event);
            });
            this.consumer.on('consumer.group_join', (event) => {
                logger_1.logger.info('Joined consumer group', event);
                this.metrics.incrementCounter('consumer_rebalances_total');
            });
            this.consumer.on('consumer.disconnect', () => {
                logger_1.logger.warn('Consumer disconnected');
                this.metrics.incrementCounter('consumer_disconnections_total');
            });
            // Start consuming with error handling
            await this.consumer.run({
                autoCommit: true,
                autoCommitInterval: 5000,
                autoCommitThreshold: 100,
                partitionsConsumedConcurrently: 3,
                eachMessage: async (payload) => {
                    if (this.isShuttingDown) {
                        logger_1.logger.info('Skipping message processing due to shutdown');
                        return;
                    }
                    this.processingCount++;
                    try {
                        await this.handleMessage(payload);
                    }
                    finally {
                        this.processingCount--;
                    }
                },
            });
            // Start health check monitor
            this.startHealthMonitor();
            logger_1.logger.info('Kafka consumer started successfully', {
                topics: config_1.config.kafka.topics,
                groupId: config_1.config.kafka.consumerGroup,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to start Kafka consumer:', error);
            throw error;
        }
    }
    async stop() {
        logger_1.logger.info('Stopping Kafka consumer...');
        this.isShuttingDown = true;
        try {
            // Wait for in-flight messages to complete
            const timeout = 30000; // 30 seconds
            const startTime = Date.now();
            while (this.processingCount > 0 && (Date.now() - startTime) < timeout) {
                logger_1.logger.info(`Waiting for ${this.processingCount} messages to complete processing...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            if (this.processingCount > 0) {
                logger_1.logger.warn(`Shutdown timeout: ${this.processingCount} messages still processing`);
            }
            // Flush any pending writes
            await this.processor.flush();
            // Disconnect from Kafka
            await this.consumer.disconnect();
            await this.producer.disconnect();
            logger_1.logger.info('Kafka consumer stopped successfully');
        }
        catch (error) {
            logger_1.logger.error('Error stopping Kafka consumer:', error);
            throw error;
        }
    }
    async handleMessage(payload) {
        const { topic, partition, message, heartbeat } = payload;
        const startTime = perf_hooks_1.performance.now();
        try {
            // Track message consumption
            this.metrics.incrementCounter('events_consumed_total', { topic });
            // Check message age
            const messageAge = Date.now() - parseInt(message.timestamp);
            if (messageAge > 300000) { // 5 minutes
                logger_1.logger.warn('Processing old message', {
                    topic,
                    partition,
                    offset: message.offset,
                    ageMs: messageAge,
                });
                this.metrics.incrementCounter('events_old_messages_total', { topic });
            }
            // Decode message with retry
            const event = await this.decodeMessageWithRetry(topic, message);
            if (!event) {
                logger_1.logger.warn('Failed to decode message after retries', { topic, partition });
                this.metrics.incrementCounter('events_decode_failures_total', { topic });
                return;
            }
            // Validate event
            if (!this.validateEvent(event)) {
                logger_1.logger.warn('Invalid event structure', { topic, partition, eventId: event.eventId });
                this.metrics.incrementCounter('events_validation_failures_total', { topic });
                await this.sendToDLQ(topic, message, new Error('Event validation failed'));
                return;
            }
            // Process event with timeout
            const processingTimeout = 30000; // 30 seconds
            await Promise.race([
                this.processor.processEvent(topic, event),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Processing timeout')), processingTimeout)),
            ]);
            // Send heartbeat to prevent rebalance during long processing
            await heartbeat();
            // Track processing time
            const duration = perf_hooks_1.performance.now() - startTime;
            this.metrics.recordHistogram('event_processing_duration_ms', duration, { topic });
            // Track lag
            const lag = Date.now() - parseInt(message.timestamp);
            this.metrics.recordHistogram('event_lag_ms', lag, { topic });
            // Log successful processing
            logger_1.logger.debug('Event processed successfully', {
                topic,
                partition,
                offset: message.offset,
                eventId: event.eventId,
                duration,
                lag,
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Error processing message', {
                topic,
                partition,
                offset: message.offset,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            });
            // Track errors
            this.metrics.incrementCounter('events_processing_errors_total', {
                topic,
                error_type: error instanceof Error ? error.constructor.name : 'unknown',
            });
            // Handle specific error types
            if (error instanceof Error && error.message.includes('Processing timeout')) {
                // Log timeout for monitoring
                logger_1.logger.warn('Processing timeout detected', {
                    topic,
                    partition,
                    offset: message.offset,
                });
                this.metrics.incrementCounter('events_processing_timeouts_total', { topic });
            }
            // Send to DLQ
            await this.sendToDLQ(topic, message, error);
        }
    }
    async decodeMessage(topic, message) {
        try {
            if (!message.value) {
                return null;
            }
            // Try to decode with schema registry
            try {
                const decoded = await this.registry.decode(message.value);
                return decoded;
            }
            catch (schemaError) {
                // Fallback to JSON parsing for backwards compatibility
                const jsonString = message.value.toString();
                return JSON.parse(jsonString);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to decode message', { topic, error });
            return null;
        }
    }
    async sendToDLQ(topic, message, error) {
        const dlqTopic = `${topic}.dlq`;
        try {
            await this.producer.send({
                topic: dlqTopic,
                messages: [{
                        key: message.key,
                        value: JSON.stringify({
                            originalTopic: topic,
                            originalOffset: message.offset,
                            originalTimestamp: message.timestamp,
                            errorMessage: error.message,
                            errorStack: error.stack,
                            processingTimestamp: new Date().toISOString(),
                            originalMessage: message.value?.toString(),
                        }),
                        headers: {
                            ...message.headers,
                            'dlq-reason': error.message,
                            'dlq-timestamp': Date.now().toString(),
                            'original-topic': topic,
                        },
                    }],
            });
            logger_1.logger.info('Message sent to DLQ', {
                originalTopic: topic,
                dlqTopic,
                offset: message.offset,
                error: error.message,
            });
            this.metrics.incrementCounter('events_dlq_sent_total', { topic });
        }
        catch (dlqError) {
            logger_1.logger.error('Failed to send message to DLQ', {
                originalTopic: topic,
                offset: message.offset,
                error: dlqError,
            });
            this.metrics.incrementCounter('events_dlq_failures_total', { topic });
        }
    }
    async decodeMessageWithRetry(topic, message, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await this.decodeMessage(topic, message);
            }
            catch (error) {
                if (attempt === retries) {
                    throw error;
                }
                logger_1.logger.warn(`Decode attempt ${attempt} failed, retrying...`, { topic, error });
                await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            }
        }
    }
    validateEvent(event) {
        // Basic validation
        if (!event || typeof event !== 'object') {
            return false;
        }
        // Required fields
        const requiredFields = ['eventId', 'eventType', 'timestamp'];
        for (const field of requiredFields) {
            if (!event[field]) {
                logger_1.logger.warn(`Missing required field: ${field}`);
                return false;
            }
        }
        // Timestamp validation
        const timestamp = new Date(event.timestamp);
        if (isNaN(timestamp.getTime())) {
            logger_1.logger.warn('Invalid timestamp format');
            return false;
        }
        // Future timestamp check
        if (timestamp.getTime() > Date.now() + 60000) { // Allow 1 minute future tolerance
            logger_1.logger.warn('Event timestamp is in the future');
            return false;
        }
        return true;
    }
    setupShutdownHandlers() {
        const signals = ['SIGTERM', 'SIGINT'];
        signals.forEach(signal => {
            process.on(signal, async () => {
                logger_1.logger.info(`Received ${signal}, initiating graceful shutdown...`);
                try {
                    await this.stop();
                    process.exit(0);
                }
                catch (error) {
                    logger_1.logger.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });
        });
    }
    startHealthMonitor() {
        setInterval(() => {
            const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
            if (timeSinceLastHeartbeat > 60000) { // 1 minute
                logger_1.logger.error('Consumer heartbeat timeout', {
                    lastHeartbeat: new Date(this.lastHeartbeat).toISOString(),
                    timeSinceLastHeartbeat,
                });
                this.metrics.incrementCounter('consumer_heartbeat_timeouts_total');
            }
            // Record processing count
            this.metrics.recordGauge('consumer_processing_messages', this.processingCount);
            // Check consumer lag
            this.checkConsumerLag();
        }, 30000); // Every 30 seconds
    }
    async checkConsumerLag() {
        try {
            // In production, use admin client to fetch consumer lag
            // For now, just log current processing status
            logger_1.logger.debug('Consumer status', {
                processingCount: this.processingCount,
                isShuttingDown: this.isShuttingDown,
                lastHeartbeat: new Date(this.lastHeartbeat).toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to check consumer lag:', error);
        }
    }
}
exports.EventConsumer = EventConsumer;
//# sourceMappingURL=event-consumer.js.map