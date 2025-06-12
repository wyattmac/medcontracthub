"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClickHouseWriter = void 0;
const client_1 = require("@clickhouse/client");
const logger_1 = require("../utils/logger");
const config_1 = require("../config");
const metrics_1 = require("../monitoring/metrics");
class ClickHouseWriter {
    client;
    metrics;
    batches = new Map();
    flushTimer;
    constructor() {
        this.client = (0, client_1.createClient)({
            host: `http://${config_1.config.clickhouse.host}:${config_1.config.clickhouse.port}`,
            database: config_1.config.clickhouse.database,
            username: config_1.config.clickhouse.username,
            password: config_1.config.clickhouse.password,
            request_timeout: config_1.config.clickhouse.requestTimeout,
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
        this.metrics = metrics_1.MetricsCollector.getInstance();
        this.startFlushTimer();
    }
    async writeOpportunityViewedEvent(event) {
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
    async writeOpportunitySavedEvent(event) {
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
    async addToBatch(table, record) {
        if (!this.batches.has(table)) {
            this.batches.set(table, []);
        }
        const batch = this.batches.get(table);
        batch.push(record);
        // Flush if batch is full
        if (batch.length >= config_1.config.processing.batchSize) {
            await this.flushTable(table);
        }
    }
    async flushTable(table) {
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
            logger_1.logger.info(`Flushed ${batch.length} records to ${table}`, {
                table,
                count: batch.length,
                duration,
            });
            // Track metrics
            this.metrics.incrementCounter('clickhouse_writes_total', { table, status: 'success' });
            this.metrics.recordHistogram('clickhouse_write_duration_ms', duration, { table });
            this.metrics.incrementCounter('records_written_total', { table }, batch.length);
        }
        catch (error) {
            logger_1.logger.error(`Failed to write to ClickHouse table ${table}`, {
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
    async flush() {
        const tables = Array.from(this.batches.keys());
        await Promise.all(tables.map(table => this.flushTable(table)));
    }
    startFlushTimer() {
        this.flushTimer = setInterval(async () => {
            try {
                await this.flush();
            }
            catch (error) {
                logger_1.logger.error('Error in flush timer:', error);
            }
        }, config_1.config.processing.flushIntervalMs);
    }
    async close() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        await this.flush();
        await this.client.close();
    }
    // Query methods for real-time analytics
    async getRealtimeMetrics() {
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
    async getTopOpportunities(hours = 24) {
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
exports.ClickHouseWriter = ClickHouseWriter;
//# sourceMappingURL=clickhouse-writer.js.map