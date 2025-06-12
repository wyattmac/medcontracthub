"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
const promClient = __importStar(require("prom-client"));
class MetricsCollector {
    static instance;
    register;
    counters = new Map();
    histograms = new Map();
    gauges = new Map();
    constructor() {
        this.register = new promClient.Registry();
        // Add default metrics
        promClient.collectDefaultMetrics({ register: this.register });
        // Initialize custom metrics
        this.initializeMetrics();
    }
    static getInstance() {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }
    async init() {
        // Any async initialization if needed
    }
    initializeMetrics() {
        // Event processing metrics
        this.counters.set('events_consumed_total', new promClient.Counter({
            name: 'analytics_events_consumed_total',
            help: 'Total number of events consumed from Kafka',
            labelNames: ['topic'],
            registers: [this.register],
        }));
        this.counters.set('events_processed_total', new promClient.Counter({
            name: 'analytics_events_processed_total',
            help: 'Total number of events processed',
            labelNames: ['topic', 'status'],
            registers: [this.register],
        }));
        this.counters.set('events_processing_errors_total', new promClient.Counter({
            name: 'analytics_events_processing_errors_total',
            help: 'Total number of event processing errors',
            labelNames: ['topic'],
            registers: [this.register],
        }));
        // ClickHouse metrics
        this.counters.set('clickhouse_writes_total', new promClient.Counter({
            name: 'analytics_clickhouse_writes_total',
            help: 'Total number of ClickHouse write operations',
            labelNames: ['table', 'status'],
            registers: [this.register],
        }));
        this.counters.set('records_written_total', new promClient.Counter({
            name: 'analytics_records_written_total',
            help: 'Total number of records written to ClickHouse',
            labelNames: ['table'],
            registers: [this.register],
        }));
        // Business metrics
        this.counters.set('opportunity_views_total', new promClient.Counter({
            name: 'analytics_opportunity_views_total',
            help: 'Total number of opportunity views',
            labelNames: ['agency', 'source'],
            registers: [this.register],
        }));
        this.counters.set('opportunity_saves_total', new promClient.Counter({
            name: 'analytics_opportunity_saves_total',
            help: 'Total number of opportunity saves',
            labelNames: ['agency', 'source'],
            registers: [this.register],
        }));
        this.counters.set('anomalies_detected_total', new promClient.Counter({
            name: 'analytics_anomalies_detected_total',
            help: 'Total number of anomalies detected',
            labelNames: ['type'],
            registers: [this.register],
        }));
        // Latency histograms
        this.histograms.set('event_processing_duration_ms', new promClient.Histogram({
            name: 'analytics_event_processing_duration_milliseconds',
            help: 'Event processing duration in milliseconds',
            labelNames: ['topic'],
            buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
            registers: [this.register],
        }));
        this.histograms.set('clickhouse_write_duration_ms', new promClient.Histogram({
            name: 'analytics_clickhouse_write_duration_milliseconds',
            help: 'ClickHouse write duration in milliseconds',
            labelNames: ['table'],
            buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000],
            registers: [this.register],
        }));
        // Current state gauges
        this.gauges.set('kafka_lag', new promClient.Gauge({
            name: 'analytics_kafka_consumer_lag',
            help: 'Current Kafka consumer lag',
            labelNames: ['topic', 'partition'],
            registers: [this.register],
        }));
        this.gauges.set('batch_size', new promClient.Gauge({
            name: 'analytics_current_batch_size',
            help: 'Current batch size waiting to be written',
            labelNames: ['table'],
            registers: [this.register],
        }));
        this.gauges.set('conversion_funnel', new promClient.Gauge({
            name: 'analytics_conversion_funnel',
            help: 'Users at each stage of the conversion funnel',
            labelNames: ['stage', 'source'],
            registers: [this.register],
        }));
        // SLO metrics
        this.gauges.set('data_freshness_seconds', new promClient.Gauge({
            name: 'analytics_data_freshness_seconds',
            help: 'Data freshness in seconds (time since last event)',
            registers: [this.register],
        }));
        this.histograms.set('query_latency_ms', new promClient.Histogram({
            name: 'analytics_query_latency_milliseconds',
            help: 'Analytics query latency',
            labelNames: ['query_type'],
            buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
            registers: [this.register],
        }));
    }
    incrementCounter(name, labels = {}, value = 1) {
        const counter = this.counters.get(name);
        if (counter) {
            counter.inc(labels, value);
        }
    }
    recordHistogram(name, value, labels = {}) {
        const histogram = this.histograms.get(name);
        if (histogram) {
            histogram.observe(labels, value);
        }
    }
    recordGauge(name, value, labels = {}) {
        const gauge = this.gauges.get(name);
        if (gauge) {
            gauge.set(labels, value);
        }
    }
    getMetrics() {
        return this.register;
    }
    async getMetricsText() {
        return this.register.metrics();
    }
}
exports.MetricsCollector = MetricsCollector;
//# sourceMappingURL=metrics.js.map