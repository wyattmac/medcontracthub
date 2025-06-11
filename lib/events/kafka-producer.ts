import { Kafka, Producer, ProducerRecord, CompressionTypes } from 'kafkajs';
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { v4 as uuidv4 } from 'uuid';

// Event types
export interface OpportunityViewedEvent {
  eventId: string;
  timestamp: number;
  opportunityId: string;
  userId: string;
  sessionId: string;
  viewContext: {
    source: 'SEARCH' | 'DASHBOARD' | 'SAVED' | 'RECOMMENDATION' | 'DIRECT_LINK';
    searchQuery?: string | null;
    referrer?: string | null;
  };
  opportunityMetadata: {
    title: string;
    agency: string;
    naicsCode?: string | null;
    setAsideType?: string | null;
    responseDeadline?: number | null;
  };
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface OpportunitySavedEvent {
  eventId: string;
  timestamp: number;
  opportunityId: string;
  userId: string;
  savedToList?: string | null;
  tags: string[];
  notes?: string | null;
  opportunityMetadata: {
    title: string;
    agency: string;
    naicsCode?: string | null;
    setAsideType?: string | null;
    responseDeadline?: number | null;
    awardAmount?: number | null;
  };
  saveContext: {
    source: 'SEARCH_RESULTS' | 'DETAIL_PAGE' | 'AI_RECOMMENDATION' | 'BULK_ACTION';
    aiRecommendationScore?: number | null;
  };
}

export class EventProducer {
  private kafka: Kafka;
  private producer: Producer;
  private registry: SchemaRegistry;
  private isConnected = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'medcontracthub-app',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      compression: CompressionTypes.GZIP,
      idempotent: true,
      maxInFlightRequests: 5,
    });

    this.registry = new SchemaRegistry({
      host: process.env.SCHEMA_REGISTRY_URL || 'http://schema-registry:8081',
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.producer.connect();
      this.isConnected = true;
      console.log('Kafka producer connected');
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.isConnected = false;
    }
  }

  async publishOpportunityViewed(
    userId: string,
    opportunityId: string,
    opportunity: any,
    context: {
      source: OpportunityViewedEvent['viewContext']['source'];
      searchQuery?: string;
      referrer?: string;
      sessionId: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<void> {
    const event: OpportunityViewedEvent = {
      eventId: uuidv4(),
      timestamp: Date.now(),
      opportunityId,
      userId,
      sessionId: context.sessionId,
      viewContext: {
        source: context.source,
        searchQuery: context.searchQuery || null,
        referrer: context.referrer || null,
      },
      opportunityMetadata: {
        title: opportunity.title,
        agency: opportunity.agency,
        naicsCode: opportunity.naicsCode || null,
        setAsideType: opportunity.setAsideType || null,
        responseDeadline: opportunity.responseDeadline ? 
          new Date(opportunity.responseDeadline).getTime() : null,
      },
      userAgent: context.userAgent || null,
      ipAddress: context.ipAddress ? this.hashIP(context.ipAddress) : null,
    };

    await this.publish('contracts.opportunity.viewed', event, opportunityId);
  }

  async publishOpportunitySaved(
    userId: string,
    opportunityId: string,
    opportunity: any,
    context: {
      source: OpportunitySavedEvent['saveContext']['source'];
      savedToList?: string;
      tags?: string[];
      notes?: string;
      aiRecommendationScore?: number;
    }
  ): Promise<void> {
    const event: OpportunitySavedEvent = {
      eventId: uuidv4(),
      timestamp: Date.now(),
      opportunityId,
      userId,
      savedToList: context.savedToList || null,
      tags: context.tags || [],
      notes: context.notes ? context.notes.substring(0, 500) : null,
      opportunityMetadata: {
        title: opportunity.title,
        agency: opportunity.agency,
        naicsCode: opportunity.naicsCode || null,
        setAsideType: opportunity.setAsideType || null,
        responseDeadline: opportunity.responseDeadline ? 
          new Date(opportunity.responseDeadline).getTime() : null,
        awardAmount: opportunity.awardAmount || null,
      },
      saveContext: {
        source: context.source,
        aiRecommendationScore: context.aiRecommendationScore || null,
      },
    };

    await this.publish('contracts.opportunity.saved', event, opportunityId);
  }

  private async publish<T>(
    topic: string,
    event: T,
    key: string
  ): Promise<void> {
    try {
      await this.connect();

      // Encode with schema registry
      const encodedValue = await this.registry.encode(
        `${topic}-value`,
        event
      );

      const record: ProducerRecord = {
        topic,
        messages: [
          {
            key,
            value: encodedValue,
            headers: {
              'event-type': topic,
              'event-id': (event as any).eventId,
              'timestamp': Date.now().toString(),
            },
          },
        ],
      };

      await this.producer.send(record);
      
      console.log(`Event published to ${topic}:`, (event as any).eventId);
    } catch (error) {
      console.error(`Failed to publish event to ${topic}:`, error);
      // Send to DLQ or local storage for retry
      await this.handleFailedEvent(topic, event, error);
      throw error;
    }
  }

  private async handleFailedEvent<T>(
    topic: string,
    event: T,
    error: any
  ): Promise<void> {
    // In production, send to DLQ or store locally for retry
    const dlqRecord: ProducerRecord = {
      topic: 'dlq.failed.events',
      messages: [
        {
          key: (event as any).eventId,
          value: JSON.stringify({
            originalTopic: topic,
            event,
            error: error.message,
            timestamp: Date.now(),
          }),
          headers: {
            'original-topic': topic,
            'error-type': error.name,
          },
        },
      ],
    };

    try {
      await this.producer.send(dlqRecord);
    } catch (dlqError) {
      console.error('Failed to send to DLQ:', dlqError);
      // Store locally as last resort
    }
  }

  private hashIP(ip: string): string {
    // Simple hash for privacy - in production use proper hashing
    return Buffer.from(ip).toString('base64').substring(0, 16);
  }
}

// Singleton instance
export const eventProducer = new EventProducer();