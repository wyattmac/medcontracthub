import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { MetricsCollector } from '../monitoring/metrics';
import { logger } from '../utils/logger';
import { config } from '../config';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  checks: {
    kafka: boolean;
    clickhouse: boolean;
    redis: boolean;
  };
}

export class HealthServer {
  private app: Express;
  private server?: Server;
  private metrics: MetricsCollector;
  private startTime: Date;

  constructor() {
    this.app = express();
    this.metrics = MetricsCollector.getInstance();
    this.startTime = new Date();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (_req: Request, res: Response) => {
      try {
        const health = await this.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Health check failed',
        });
      }
    });

    // Readiness check endpoint
    this.app.get('/ready', async (_req: Request, res: Response) => {
      try {
        const isReady = await this.checkReadiness();
        if (isReady) {
          res.status(200).json({ ready: true });
        } else {
          res.status(503).json({ ready: false });
        }
      } catch (error) {
        res.status(503).json({ 
          ready: false, 
          error: error instanceof Error ? error.message : 'Readiness check failed' 
        });
      }
    });

    // Liveness check endpoint
    this.app.get('/live', (_req: Request, res: Response) => {
      res.status(200).json({ alive: true });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (_req: Request, res: Response) => {
      try {
        const metrics = await this.metrics.getMetricsText();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error) {
        logger.error('Failed to get metrics:', error);
        res.status(500).send('Failed to get metrics');
      }
    });

    // Service info endpoint
    this.app.get('/info', (_req: Request, res: Response) => {
      res.json({
        service: 'analytics-service',
        version: process.env['VERSION'] || '1.0.0',
        environment: config.env,
        uptime: this.getUptime(),
        startTime: this.startTime.toISOString(),
        kafka: {
          brokers: config.kafka.brokers,
          topics: config.kafka.topics,
          consumerGroup: config.kafka.consumerGroup,
        },
        clickhouse: {
          host: config.clickhouse.host,
          database: config.clickhouse.database,
        },
      });
    });

    // SLO status endpoint
    this.app.get('/slo', async (_req: Request, res: Response) => {
      try {
        const sloStatus = await this.getSLOStatus();
        res.json(sloStatus);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get SLO status' });
      }
    });
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        logger.info(`Health server listening on port ${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Health server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async getHealthStatus(): Promise<HealthStatus> {
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

  private async checkReadiness(): Promise<boolean> {
    // Check if service is ready to accept traffic
    // In production, verify all connections are established
    return true;
  }

  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  private async getSLOStatus(): Promise<any> {
    // Calculate SLO metrics
    const dataFreshness = 2.5; // minutes - would be calculated from actual data
    const queryLatencyP99 = 450; // ms - from actual metrics
    const availability = 0.998; // from uptime metrics

    return {
      slos: {
        dataFreshness: {
          target: config.slos.dataFreshnessMinutes,
          current: dataFreshness,
          withinSLO: dataFreshness <= config.slos.dataFreshnessMinutes,
        },
        queryLatency: {
          target: config.slos.queryLatencyP99Ms,
          current: queryLatencyP99,
          withinSLO: queryLatencyP99 <= config.slos.queryLatencyP99Ms,
        },
        availability: {
          target: config.slos.availabilityTarget,
          current: availability,
          withinSLO: availability >= config.slos.availabilityTarget,
        },
      },
      errorBudget: {
        remaining: ((1 - config.slos.availabilityTarget) - (1 - availability)) * 100,
        unit: 'percentage',
      },
    };
  }
}