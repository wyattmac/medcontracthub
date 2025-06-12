"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventProcessor = void 0;
const logger_1 = require("../utils/logger");
const metrics_1 = require("../monitoring/metrics");
class EventProcessor {
    clickhouseWriter;
    metrics;
    eventHandlers;
    constructor(clickhouseWriter) {
        this.clickhouseWriter = clickhouseWriter;
        this.metrics = metrics_1.MetricsCollector.getInstance();
        // Register event handlers
        this.eventHandlers = new Map([
            ['contracts.opportunity.viewed', this.handleOpportunityViewed.bind(this)],
            ['contracts.opportunity.saved', this.handleOpportunitySaved.bind(this)],
            ['contracts.proposal.created', this.handleProposalCreated.bind(this)],
            ['contracts.proposal.updated', this.handleProposalUpdated.bind(this)],
            ['ai.document.processed', this.handleDocumentProcessed.bind(this)],
            ['user.activity', this.handleUserActivity.bind(this)],
        ]);
    }
    async processEvent(topic, event) {
        const handler = this.eventHandlers.get(topic);
        if (!handler) {
            logger_1.logger.warn(`No handler registered for topic: ${topic}`);
            this.metrics.incrementCounter('events_unhandled_total', { topic });
            return;
        }
        try {
            await handler(event);
            this.metrics.incrementCounter('events_processed_total', { topic, status: 'success' });
        }
        catch (error) {
            logger_1.logger.error(`Error processing event from topic ${topic}:`, error);
            this.metrics.incrementCounter('events_processed_total', { topic, status: 'error' });
            throw error;
        }
    }
    async handleOpportunityViewed(event) {
        // Write to raw events table
        await this.clickhouseWriter.writeOpportunityViewedEvent(event);
        // Update real-time aggregations
        await this.updateViewAggregations(event);
        // Check for anomalies
        await this.detectViewAnomalies(event);
    }
    async handleOpportunitySaved(event) {
        // Write to saves table
        await this.clickhouseWriter.writeOpportunitySavedEvent(event);
        // Update user engagement metrics
        await this.updateEngagementMetrics(event);
        // Calculate conversion funnel
        await this.updateConversionFunnel(event);
    }
    async handleProposalCreated(event) {
        // Implementation for proposal created events
        logger_1.logger.info('Processing proposal created event', { eventId: event.eventId });
    }
    async handleProposalUpdated(event) {
        // Implementation for proposal updated events
        logger_1.logger.info('Processing proposal updated event', { eventId: event.eventId });
    }
    async handleDocumentProcessed(event) {
        // Implementation for document processed events
        logger_1.logger.info('Processing document processed event', { eventId: event.eventId });
    }
    async handleUserActivity(event) {
        // Implementation for user activity events
        logger_1.logger.info('Processing user activity event', { eventId: event.eventId });
    }
    async updateViewAggregations(event) {
        // In production, update materialized views or aggregation tables
        // For now, just track metrics
        this.metrics.incrementCounter('opportunity_views_total', {
            agency: event.opportunityMetadata.agency,
            source: event.viewContext.source,
        });
    }
    async detectViewAnomalies(event) {
        // Simple anomaly detection - in production, use ML models
        const viewsInLastMinute = await this.getRecentViewCount(event.userId);
        if (viewsInLastMinute > 100) {
            logger_1.logger.warn('Potential view anomaly detected', {
                userId: event.userId,
                viewsInLastMinute,
            });
            this.metrics.incrementCounter('anomalies_detected_total', {
                type: 'excessive_views',
            });
        }
    }
    async updateEngagementMetrics(event) {
        // Track save-to-view ratio and other engagement metrics
        this.metrics.incrementCounter('opportunity_saves_total', {
            agency: event.opportunityMetadata.agency,
            source: event.saveContext.source,
        });
    }
    async updateConversionFunnel(event) {
        // Track conversion through the funnel
        this.metrics.recordGauge('conversion_funnel', 1, {
            stage: 'saved',
            source: event.saveContext.source,
        });
    }
    async getRecentViewCount(_userId) {
        // In production, query ClickHouse or use Redis cache
        // For now, return a mock value
        return 5;
    }
    async flush() {
        await this.clickhouseWriter.flush();
    }
}
exports.EventProcessor = EventProcessor;
//# sourceMappingURL=event-processor.js.map