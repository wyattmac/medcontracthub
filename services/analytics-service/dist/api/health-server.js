"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthServer = void 0;
const express_1 = __importDefault(require("express"));
const metrics_1 = require("../monitoring/metrics");
const logger_1 = require("../utils/logger");
const config_1 = require("../config");
class HealthServer {
    app;
    server;
    metrics;
    startTime;
    constructor() {
        this.app = (0, express_1.default)();
        this.metrics = metrics_1.MetricsCollector.getInstance();
        this.startTime = new Date();
        this.setupRoutes();
    }
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', async (_req, res) => {
            try {
                const health = await this.getHealthStatus();
                const statusCode = health.status === 'healthy' ? 200 : 503;
                res.status(statusCode).json(health);
            }
            catch (error) {
                logger_1.logger.error('Health check failed:', error);
                res.status(503).json({
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : 'Health check failed',
                });
            }
        });
        // Readiness check endpoint
        this.app.get('/ready', async (_req, res) => {
            try {
                const isReady = await this.checkReadiness();
                if (isReady) {
                    res.status(200).json({ ready: true });
                }
                else {
                    res.status(503).json({ ready: false });
                }
            }
            catch (error) {
                res.status(503).json({
                    ready: false,
                    error: error instanceof Error ? error.message : 'Readiness check failed'
                });
            }
        });
        // Liveness check endpoint
        this.app.get('/live', (_req, res) => {
            res.status(200).json({ alive: true });
        });
        // Metrics endpoint
        this.app.get('/metrics', async (_req, res) => {
            try {
                const metrics = await this.metrics.getMetricsText();
                res.set('Content-Type', 'text/plain');
                res.send(metrics);
            }
            catch (error) {
                logger_1.logger.error('Failed to get metrics:', error);
                res.status(500).send('Failed to get metrics');
            }
        });
        // Service info endpoint
        this.app.get('/info', (_req, res) => {
            res.json({
                service: 'analytics-service',
                version: process.env['VERSION'] || '1.0.0',
                environment: config_1.config.env,
                uptime: this.getUptime(),
                startTime: this.startTime.toISOString(),
                kafka: {
                    brokers: config_1.config.kafka.brokers,
                    topics: config_1.config.kafka.topics,
                    consumerGroup: config_1.config.kafka.consumerGroup,
                },
                clickhouse: {
                    host: config_1.config.clickhouse.host,
                    database: config_1.config.clickhouse.database,
                },
            });
        });
        // SLO status endpoint
        this.app.get('/slo', async (_req, res) => {
            try {
                const sloStatus = await this.getSLOStatus();
                res.json(sloStatus);
            }
            catch (error) {
                res.status(500).json({ error: 'Failed to get SLO status' });
            }
        });
    }
    async start(port) {
        return new Promise((resolve) => {
            this.server = this.app.listen(port, () => {
                logger_1.logger.info(`Health server listening on port ${port}`);
                resolve();
            });
        });
    }
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    logger_1.logger.info('Health server stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    async getHealthStatus() {
        // In production, check actual service health
        const checks = {
            kafka: true, // Check Kafka consumer health
            clickhouse: true, // Check ClickHouse connection
            redis: true, // Check Redis connection
        };
        const isHealthy = Object.values(checks).every(check => check);
        return {
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            service: 'analytics-service',
            version: process.env['VERSION'] || '1.0.0',
            uptime: this.getUptime(),
            checks,
        };
    }
    async checkReadiness() {
        // Check if service is ready to accept traffic
        // In production, verify all connections are established
        return true;
    }
    getUptime() {
        return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    }
    async getSLOStatus() {
        // Calculate SLO metrics
        const dataFreshness = 2.5; // minutes - would be calculated from actual data
        const queryLatencyP99 = 450; // ms - from actual metrics
        const availability = 0.998; // from uptime metrics
        return {
            slos: {
                dataFreshness: {
                    target: config_1.config.slos.dataFreshnessMinutes,
                    current: dataFreshness,
                    withinSLO: dataFreshness <= config_1.config.slos.dataFreshnessMinutes,
                },
                queryLatency: {
                    target: config_1.config.slos.queryLatencyP99Ms,
                    current: queryLatencyP99,
                    withinSLO: queryLatencyP99 <= config_1.config.slos.queryLatencyP99Ms,
                },
                availability: {
                    target: config_1.config.slos.availabilityTarget,
                    current: availability,
                    withinSLO: availability >= config_1.config.slos.availabilityTarget,
                },
            },
            errorBudget: {
                remaining: ((1 - config_1.config.slos.availabilityTarget) - (1 - availability)) * 100,
                unit: 'percentage',
            },
        };
    }
}
exports.HealthServer = HealthServer;
//# sourceMappingURL=health-server.js.map