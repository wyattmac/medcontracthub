import { ClickHouseWriter } from '../writers/clickhouse-writer';
import { logger } from '../utils/logger';
import { MetricsCollector } from '../monitoring/metrics';

export class EventProcessor {
  private clickhouseWriter: ClickHouseWriter;
  private metrics: MetricsCollector;
  private eventHandlers: Map<string, (event: any) => Promise<void>>;

  constructor(clickhouseWriter: ClickHouseWriter) {
    this.clickhouseWriter = clickhouseWriter;
    this.metrics = MetricsCollector.getInstance();
    
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

  async processEvent(topic: string, event: any): Promise<void> {
    const handler = this.eventHandlers.get(topic);
    
    if (!handler) {
      logger.warn(`No handler registered for topic: ${topic}`);
      this.metrics.incrementCounter('events_unhandled_total', { topic });
      return;
    }

    try {
      await handler(event);
      this.metrics.incrementCounter('events_processed_total', { topic, status: 'success' });
    } catch (error) {
      logger.error(`Error processing event from topic ${topic}:`, error);
      this.metrics.incrementCounter('events_processed_total', { topic, status: 'error' });
      throw error;
    }
  }

  private async handleOpportunityViewed(event: any): Promise<void> {
    // Write to raw events table
    await this.clickhouseWriter.writeOpportunityViewedEvent(event);
    
    // Update real-time aggregations
    await this.updateViewAggregations(event);
    
    // Check for anomalies
    await this.detectViewAnomalies(event);
  }

  private async handleOpportunitySaved(event: any): Promise<void> {
    // Write to saves table
    await this.clickhouseWriter.writeOpportunitySavedEvent(event);
    
    // Update user engagement metrics
    await this.updateEngagementMetrics(event);
    
    // Calculate conversion funnel
    await this.updateConversionFunnel(event);
  }

  private async handleProposalCreated(event: any): Promise<void> {
    // Implementation for proposal created events
    logger.info('Processing proposal created event', { eventId: event.eventId });
  }

  private async handleProposalUpdated(event: any): Promise<void> {
    // Implementation for proposal updated events
    logger.info('Processing proposal updated event', { eventId: event.eventId });
  }

  private async handleDocumentProcessed(event: any): Promise<void> {
    // Implementation for document processed events
    logger.info('Processing document processed event', { eventId: event.eventId });
  }

  private async handleUserActivity(event: any): Promise<void> {
    // Implementation for user activity events
    logger.info('Processing user activity event', { eventId: event.eventId });
  }

  private async updateViewAggregations(event: any): Promise<void> {
    // In production, update materialized views or aggregation tables
    // For now, just track metrics
    this.metrics.incrementCounter('opportunity_views_total', {
      agency: event.opportunityMetadata.agency,
      source: event.viewContext.source,
    });
  }

  private async detectViewAnomalies(event: any): Promise<void> {
    // Simple anomaly detection - in production, use ML models
    const viewsInLastMinute = await this.getRecentViewCount(event.userId);
    
    if (viewsInLastMinute > 100) {
      logger.warn('Potential view anomaly detected', {
        userId: event.userId,
        viewsInLastMinute,
      });
      
      this.metrics.incrementCounter('anomalies_detected_total', {
        type: 'excessive_views',
      });
    }
  }

  private async updateEngagementMetrics(event: any): Promise<void> {
    // Track save-to-view ratio and other engagement metrics
    this.metrics.incrementCounter('opportunity_saves_total', {
      agency: event.opportunityMetadata.agency,
      source: event.saveContext.source,
    });
  }

  private async updateConversionFunnel(event: any): Promise<void> {
    // Track conversion through the funnel
    this.metrics.recordGauge('conversion_funnel', 1, {
      stage: 'saved',
      source: event.saveContext.source,
    });
  }

  private async getRecentViewCount(userId: string): Promise<number> {
    // In production, query ClickHouse or use Redis cache
    // For now, return a mock value
    return 5;
  }

  async flush(): Promise<void> {
    await this.clickhouseWriter.flush();
  }
}