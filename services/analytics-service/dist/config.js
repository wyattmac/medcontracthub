"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const configSchema = zod_1.z.object({
    env: zod_1.z.enum(['development', 'staging', 'production']).default('development'),
    port: zod_1.z.number().default(8300),
    // Kafka configuration
    kafka: zod_1.z.object({
        brokers: zod_1.z.array(zod_1.z.string()).default(['kafka:9092']),
        clientId: zod_1.z.string().default('analytics-service'),
        consumerGroup: zod_1.z.string().default('analytics-consumer-group'),
        topics: zod_1.z.array(zod_1.z.string()).default([
            'contracts.opportunity.viewed',
            'contracts.opportunity.saved',
            'contracts.proposal.created',
            'contracts.proposal.updated',
            'ai.document.processed',
            'user.activity',
        ]),
        sessionTimeout: zod_1.z.number().default(30000),
        rebalanceTimeout: zod_1.z.number().default(60000),
    }),
    // Schema Registry
    schemaRegistry: zod_1.z.object({
        url: zod_1.z.string().default('http://schema-registry:8081'),
    }),
    // ClickHouse configuration
    clickhouse: zod_1.z.object({
        host: zod_1.z.string().default('clickhouse'),
        port: zod_1.z.number().default(8123),
        database: zod_1.z.string().default('medcontract_analytics'),
        username: zod_1.z.string().default('default'),
        password: zod_1.z.string().default(''),
        requestTimeout: zod_1.z.number().default(30000),
    }),
    // Redis configuration (for caching)
    redis: zod_1.z.object({
        host: zod_1.z.string().default('redis-cluster'),
        port: zod_1.z.number().default(6379),
        ttl: zod_1.z.number().default(300), // 5 minutes
    }),
    // Processing configuration
    processing: zod_1.z.object({
        batchSize: zod_1.z.number().default(1000),
        flushIntervalMs: zod_1.z.number().default(5000),
        maxConcurrentQueries: zod_1.z.number().default(10),
        retryAttempts: zod_1.z.number().default(3),
        retryDelayMs: zod_1.z.number().default(1000),
    }),
    // Monitoring
    monitoring: zod_1.z.object({
        metricsPort: zod_1.z.number().default(9090),
        healthCheckIntervalMs: zod_1.z.number().default(30000),
    }),
    // SLOs
    slos: zod_1.z.object({
        dataFreshnessMinutes: zod_1.z.number().default(5),
        queryLatencyP99Ms: zod_1.z.number().default(500),
        availabilityTarget: zod_1.z.number().default(0.995),
    }),
});
// Parse and validate configuration
const parseConfig = () => {
    const env = {
        env: process.env['NODE_ENV'],
        port: Number(process.env['PORT']) || undefined,
        kafka: {
            brokers: process.env['KAFKA_BROKERS']?.split(','),
            clientId: process.env['KAFKA_CLIENT_ID'],
            consumerGroup: process.env['KAFKA_CONSUMER_GROUP'],
            topics: process.env['KAFKA_TOPICS']?.split(','),
        },
        schemaRegistry: {
            url: process.env['SCHEMA_REGISTRY_URL'],
        },
        clickhouse: {
            host: process.env['CLICKHOUSE_HOST'],
            port: Number(process.env['CLICKHOUSE_PORT']) || undefined,
            database: process.env['CLICKHOUSE_DATABASE'],
            username: process.env['CLICKHOUSE_USERNAME'],
            password: process.env['CLICKHOUSE_PASSWORD'],
        },
        redis: {
            host: process.env['REDIS_HOST'],
            port: Number(process.env['REDIS_PORT']) || undefined,
        },
        processing: {
            batchSize: Number(process.env['BATCH_SIZE']) || undefined,
            flushIntervalMs: Number(process.env['FLUSH_INTERVAL_MS']) || undefined,
        },
        monitoring: {
            metricsPort: Number(process.env['METRICS_PORT']) || undefined,
        },
    };
    // Remove undefined values
    const cleanEnv = JSON.parse(JSON.stringify(env));
    return configSchema.parse(cleanEnv);
};
exports.config = parseConfig();
// Log configuration (without sensitive data)
console.log('Analytics Service Configuration:', {
    env: exports.config.env,
    port: exports.config.port,
    kafka: {
        brokers: exports.config.kafka.brokers,
        topics: exports.config.kafka.topics,
    },
    clickhouse: {
        host: exports.config.clickhouse.host,
        database: exports.config.clickhouse.database,
    },
});
//# sourceMappingURL=config.js.map