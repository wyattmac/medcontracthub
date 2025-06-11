import { createClient, ClickHouseClient } from '@clickhouse/client';
import { logger } from '../utils/logger';
import { config } from '../config';
import { MetricsCollector } from '../monitoring/metrics';

export class ClickHouseWriter {
  private client: ClickHouseClient;
  private metrics: MetricsCollector;
  private batches: Map<string, any[]> = new Map();
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.client = createClient({
      host: `http://${config.clickhouse.host}:${config.clickhouse.port}`,
      database: config.clickhouse.database,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      request_timeout: config.clickhouse.requestTimeout,
      compression: {
        request: true,
        response: true,
      },
      clickhouse_settings: {
        async_insert: 1,
        wait_for_async_insert: 0,
        async_insert_max_data_size: '10MB',
        async_insert_busy_timeout_ms: 1000,
      },
    });

    this.metrics = MetricsCollector.getInstance();
    this.startFlushTimer();
  }

  async writeOpportunityViewedEvent(event: any): Promise<void> {
    const record = {
      event_id: event.eventId,
      timestamp: new Date(event.timestamp),
      opportunity_id: event.opportunityId,
      user_id: event.userId,
      session_id: event.sessionId,
      view_source: event.viewContext.source,
      search_query: event.viewContext.searchQuery || '',
      referrer: event.viewContext.referrer || '',
      opportunity_title: event.opportunityMetadata.title,
      agency: event.opportunityMetadata.agency,
      naics_code: event.opportunityMetadata.naicsCode || '',
      set_aside_type: event.opportunityMetadata.setAsideType || '',
      response_deadline: event.opportunityMetadata.responseDeadline 
        ? new Date(event.opportunityMetadata.responseDeadline) : null,
      user_agent: event.userAgent || '',
      ip_hash: event.ipAddress || '',
    };

    await this.addToBatch('opportunity_views', record);
  }

  async writeOpportunitySavedEvent(event: any): Promise<void> {
    const record = {
      event_id: event.eventId,
      timestamp: new Date(event.timestamp),
      opportunity_id: event.opportunityId,
      user_id: event.userId,
      saved_to_list: event.savedToList || '',
      tags: event.tags,
      notes: event.notes || '',
      opportunity_title: event.opportunityMetadata.title,
      agency: event.opportunityMetadata.agency,
      naics_code: event.opportunityMetadata.naicsCode || '',
      set_aside_type: event.opportunityMetadata.setAsideType || '',
      response_deadline: event.opportunityMetadata.responseDeadline 
        ? new Date(event.opportunityMetadata.responseDeadline) : null,
      award_amount: event.opportunityMetadata.awardAmount || 0,
      save_source: event.saveContext.source,
      ai_score: event.saveContext.aiRecommendationScore || 0,
    };

    await this.addToBatch('opportunity_saves', record);
  }

  private async addToBatch(table: string, record: any): Promise<void> {
    if (!this.batches.has(table)) {
      this.batches.set(table, []);
    }

    const batch = this.batches.get(table)!;
    batch.push(record);

    // Flush if batch is full
    if (batch.length >= config.processing.batchSize) {
      await this.flushTable(table);
    }
  }

  private async flushTable(table: string): Promise<void> {
    const batch = this.batches.get(table);
    if (!batch || batch.length === 0) {
      return;
    }

    // Clear the batch immediately to avoid duplicates
    this.batches.set(table, []);

    const startTime = Date.now();
    
    try {
      await this.client.insert({
        table,
        values: batch,
        format: 'JSONEachRow',
      });

      const duration = Date.now() - startTime;
      
      logger.info(`Flushed ${batch.length} records to ${table}`, {
        table,
        count: batch.length,
        duration,
      });

      // Track metrics
      this.metrics.incrementCounter('clickhouse_writes_total', { table, status: 'success' });
      this.metrics.recordHistogram('clickhouse_write_duration_ms', duration, { table });
      this.metrics.incrementCounter('records_written_total', { table }, batch.length);

    } catch (error) {
      logger.error(`Failed to write to ClickHouse table ${table}`, {
        table,
        error,
        batchSize: batch.length,
      });

      // Track error
      this.metrics.incrementCounter('clickhouse_writes_total', { table, status: 'error' });

      // In production, implement retry logic or write to fallback storage
      throw error;
    }
  }

  async flush(): Promise<void> {
    const tables = Array.from(this.batches.keys());
    
    await Promise.all(
      tables.map(table => this.flushTable(table))
    );
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        logger.error('Error in flush timer:', error);
      }
    }, config.processing.flushIntervalMs);
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    await this.flush();
    await this.client.close();
  }

  // Query methods for real-time analytics
  async getRealtimeMetrics(): Promise<any> {
    const query = `
      SELECT
        toStartOfMinute(timestamp) as minute,
        count() as views,
        uniq(user_id) as unique_users,
        uniq(opportunity_id) as unique_opportunities
      FROM opportunity_views
      WHERE timestamp >= now() - INTERVAL 1 HOUR
      GROUP BY minute
      ORDER BY minute DESC
      LIMIT 60
    `;

    const result = await this.client.query({
      query,
      format: 'JSONEachRow',
    });

    return result.json();
  }

  async getTopOpportunities(hours: number = 24): Promise<any> {
    const query = `
      SELECT
        opportunity_id,
        opportunity_title,
        agency,
        count() as view_count,
        uniq(user_id) as unique_viewers,
        countIf(user_id IN (SELECT user_id FROM opportunity_saves WHERE opportunity_id = v.opportunity_id)) as save_count
      FROM opportunity_views v
      WHERE timestamp >= now() - INTERVAL ${hours} HOUR
      GROUP BY opportunity_id, opportunity_title, agency
      ORDER BY view_count DESC
      LIMIT 20
    `;

    const result = await this.client.query({
      query,
      format: 'JSONEachRow',
    });

    return result.json();
  }
}