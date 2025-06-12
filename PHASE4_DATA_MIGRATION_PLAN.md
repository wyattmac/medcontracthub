# Phase 4: Data Migration Scripts Plan

## Overview
This phase focuses on implementing data migration scripts to transition from the monolithic architecture to the microservices architecture with event sourcing, distributed databases, and proper correlation tracking.

## Goals
1. Add event sourcing infrastructure to PostgreSQL
2. Create data migration scripts for Kafka, ClickHouse, and Weaviate
3. Implement correlation ID tracking across all services
4. Establish rollback procedures for safety
5. Ensure zero downtime migration capability

## 1. Schema Migrations (3-4 hours)

### 1.1 Event Sourcing Infrastructure
```sql
-- migrations/016_event_sourcing_infrastructure.sql
-- Core event store table
CREATE TABLE IF NOT EXISTS event_store (
  event_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_version INTEGER NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  correlation_id UUID,
  causation_id UUID,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for querying
  INDEX idx_event_store_aggregate (aggregate_id, event_version),
  INDEX idx_event_store_type (event_type, created_at),
  INDEX idx_event_store_correlation (correlation_id),
  INDEX idx_event_store_user (user_id, created_at)
);

-- Event snapshots for performance
CREATE TABLE IF NOT EXISTS event_snapshots (
  snapshot_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  snapshot_version INTEGER NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(aggregate_id, snapshot_version)
);

-- Outbox pattern for reliable event publishing
CREATE TABLE IF NOT EXISTS event_outbox (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  topic VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  partition_key VARCHAR(100),
  headers JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP WITH TIME ZONE,
  
  INDEX idx_outbox_status (status, created_at),
  INDEX idx_outbox_aggregate (aggregate_id)
);
```

### 1.2 Service Tracking Columns
```sql
-- migrations/017_microservices_tracking.sql
-- Add service tracking to existing tables
ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS processed_by_services JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_sync_to_kafka TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS embedding_version INTEGER DEFAULT 0;

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS event_stream_position BIGINT,
ADD COLUMN IF NOT EXISTS analytics_synced BOOLEAN DEFAULT FALSE;

ALTER TABLE contract_documents
ADD COLUMN IF NOT EXISTS ocr_service_version VARCHAR(20),
ADD COLUMN IF NOT EXISTS processing_correlation_id UUID;

-- Service processing log
CREATE TABLE IF NOT EXISTS service_processing_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  service_name VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  correlation_id UUID,
  processing_time_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_processing_entity (entity_id, service_name),
  INDEX idx_processing_correlation (correlation_id)
);
```

### 1.3 Migration State Tracking
```sql
-- migrations/018_migration_state.sql
CREATE TABLE IF NOT EXISTS data_migration_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_name VARCHAR(100) NOT NULL UNIQUE,
  entity_type VARCHAR(50) NOT NULL,
  last_processed_id UUID,
  last_processed_at TIMESTAMP WITH TIME ZONE,
  total_processed INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  
  INDEX idx_migration_status (status, entity_type)
);

-- Checkpoints for resumable migrations
CREATE TABLE IF NOT EXISTS migration_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_id UUID REFERENCES data_migration_state(id),
  checkpoint_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 2. Data Sync Scripts (4-5 hours)

### 2.1 Kafka Event Publisher
```typescript
// scripts/migrate-to-kafka.ts
import { createClient } from '@supabase/supabase-js'
import { Kafka, Producer } from 'kafkajs'
import { v4 as uuidv4 } from 'uuid'

class KafkaDataMigrator {
  private producer: Producer
  private batchSize = 1000
  private checkpointInterval = 5000

  async migrateOpportunities() {
    const lastCheckpoint = await this.getLastCheckpoint('opportunities')
    
    const opportunities = await this.fetchBatch(
      'opportunities',
      lastCheckpoint,
      this.batchSize
    )

    for (const opp of opportunities) {
      const event = {
        eventId: uuidv4(),
        eventType: 'OpportunityMigrated',
        aggregateId: opp.id,
        timestamp: new Date().toISOString(),
        data: opp,
        metadata: {
          migrationRun: this.migrationId,
          source: 'postgresql',
          version: '1.0'
        }
      }

      await this.publishToKafka(
        'contracts.opportunities.migrated',
        event,
        opp.id
      )
    }

    await this.saveCheckpoint('opportunities', opportunities[opportunities.length - 1].id)
  }

  async publishToKafka(topic: string, event: any, key: string) {
    await this.producer.send({
      topic,
      messages: [{
        key,
        value: JSON.stringify(event),
        headers: {
          'correlation-id': this.correlationId,
          'migration-id': this.migrationId
        }
      }]
    })
  }
}
```

### 2.2 ClickHouse Analytics Populator
```typescript
// scripts/populate-clickhouse-analytics.ts
import { ClickHouse } from 'clickhouse'

class ClickHousePopulator {
  async createAnalyticsTables() {
    // Opportunity analytics
    await this.ch.query(`
      CREATE TABLE IF NOT EXISTS opportunity_events (
        event_id UUID,
        opportunity_id UUID,
        event_type String,
        notice_type String,
        agency String,
        set_aside_type Nullable(String),
        naics_code Nullable(String),
        award_amount Nullable(Decimal64(2)),
        response_deadline DateTime,
        created_at DateTime,
        user_id Nullable(UUID),
        company_id Nullable(UUID),
        INDEX idx_opportunity_id opportunity_id TYPE bloom_filter GRANULARITY 1,
        INDEX idx_event_type event_type TYPE set(100) GRANULARITY 1,
        INDEX idx_created_at created_at TYPE minmax GRANULARITY 1
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(created_at)
      ORDER BY (created_at, opportunity_id)
    `)

    // API usage metrics
    await this.ch.query(`
      CREATE TABLE IF NOT EXISTS api_usage_events (
        event_id UUID,
        user_id UUID,
        company_id UUID,
        endpoint String,
        method String,
        status_code UInt16,
        response_time_ms UInt32,
        cost_units Decimal32(4),
        timestamp DateTime,
        metadata String
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (timestamp, user_id)
    `)
  }

  async migrateHistoricalData() {
    // Batch process historical opportunities
    const query = `
      INSERT INTO opportunity_events
      SELECT
        generateUUIDv4() as event_id,
        id as opportunity_id,
        'HistoricalImport' as event_type,
        notice_type,
        agency,
        set_aside_type,
        naics_code,
        award_amount,
        response_deadline,
        created_at,
        NULL as user_id,
        NULL as company_id
      FROM postgresql('host:port', 'database', 'opportunities', 'user', 'password')
      WHERE created_at >= today() - INTERVAL 90 DAY
    `
    
    await this.ch.query(query)
  }
}
```

### 2.3 Weaviate Embeddings Initializer
```typescript
// scripts/initialize-weaviate-embeddings.ts
import weaviate from 'weaviate-ts-client'

class WeaviateInitializer {
  async createSchemas() {
    // Opportunity schema
    const opportunitySchema = {
      class: 'Opportunity',
      description: 'Federal contracting opportunity',
      properties: [
        {
          name: 'title',
          dataType: ['text'],
          description: 'Opportunity title'
        },
        {
          name: 'description',
          dataType: ['text'],
          description: 'Full description'
        },
        {
          name: 'agency',
          dataType: ['string']
        },
        {
          name: 'naicsCode',
          dataType: ['string']
        },
        {
          name: 'requirements',
          dataType: ['text[]']
        },
        {
          name: 'embeddings_version',
          dataType: ['int']
        }
      ],
      vectorizer: 'text2vec-transformers'
    }

    await this.client.schema
      .classCreator()
      .withClass(opportunitySchema)
      .do()
  }

  async populateEmbeddings() {
    const opportunities = await this.fetchOpportunities()
    
    const batcher = this.client.batch.objectsBatcher()
    
    for (const opp of opportunities) {
      batcher.withObject({
        class: 'Opportunity',
        id: opp.id,
        properties: {
          title: opp.title,
          description: opp.description,
          agency: opp.agency,
          naicsCode: opp.naics_code,
          requirements: opp.requirements || [],
          embeddings_version: 1
        }
      })
    }

    await batcher.do()
  }
}
```

## 3. Rollback Procedures (2-3 hours)

### 3.1 Service-by-Service Rollback Script
```bash
#!/bin/bash
# scripts/rollback-microservices.sh

set -e

ROLLBACK_SERVICE=$1
ROLLBACK_TO_VERSION=$2

case $ROLLBACK_SERVICE in
  "ocr-service")
    echo "Rolling back OCR Service..."
    kubectl set image deployment/ocr-service ocr-service=medcontracthub/ocr-service:$ROLLBACK_TO_VERSION -n medcontracthub
    
    # Revert Kafka consumer group offset
    kafka-consumer-groups.sh --bootstrap-server kafka:9092 \
      --group ocr-service-consumer \
      --reset-offsets --to-datetime $ROLLBACK_TIMESTAMP \
      --execute
    ;;
    
  "analytics-service")
    echo "Rolling back Analytics Service..."
    kubectl set image deployment/analytics-service analytics-service=medcontracthub/analytics-service:$ROLLBACK_TO_VERSION -n medcontracthub
    
    # Restore ClickHouse from backup
    clickhouse-client --query "DROP TABLE opportunity_events"
    clickhouse-client --query "ATTACH TABLE opportunity_events FROM '/backup/$ROLLBACK_DATE/'"
    ;;
    
  "all")
    echo "Full rollback initiated..."
    ./scripts/rollback-microservices.sh ocr-service $ROLLBACK_TO_VERSION
    ./scripts/rollback-microservices.sh analytics-service $ROLLBACK_TO_VERSION
    ./scripts/rollback-microservices.sh ai-service $ROLLBACK_TO_VERSION
    ./scripts/rollback-microservices.sh realtime-service $ROLLBACK_TO_VERSION
    ./scripts/rollback-microservices.sh worker-service $ROLLBACK_TO_VERSION
    ;;
esac
```

### 3.2 Data Consistency Checker
```typescript
// scripts/check-data-consistency.ts
class DataConsistencyChecker {
  async checkOpportunityConsistency() {
    const postgresCount = await this.getPostgresCount('opportunities')
    const kafkaCount = await this.getKafkaMessageCount('contracts.opportunities.*')
    const clickhouseCount = await this.getClickHouseCount('opportunity_events')
    const weaviateCount = await this.getWeaviateCount('Opportunity')

    const report = {
      postgres: postgresCount,
      kafka: kafkaCount,
      clickhouse: clickhouseCount,
      weaviate: weaviateCount,
      discrepancies: []
    }

    if (Math.abs(postgresCount - clickhouseCount) > 100) {
      report.discrepancies.push({
        type: 'count_mismatch',
        source: 'postgres-clickhouse',
        difference: postgresCount - clickhouseCount
      })
    }

    return report
  }

  async validateEventOrdering() {
    // Check that events are in correct order
    const query = `
      SELECT 
        aggregate_id,
        event_version,
        LAG(event_version) OVER (PARTITION BY aggregate_id ORDER BY event_version) as prev_version
      FROM event_store
      WHERE created_at >= NOW() - INTERVAL '1 day'
    `
    
    const results = await this.db.query(query)
    const gaps = results.filter(r => 
      r.prev_version && r.event_version !== r.prev_version + 1
    )
    
    return { gaps, isValid: gaps.length === 0 }
  }
}
```

## 4. Testing & Validation (2 hours)

### 4.1 Migration Test Suite
```typescript
// tests/migration/data-migration.test.ts
describe('Data Migration Tests', () => {
  describe('Kafka Migration', () => {
    it('should migrate all opportunities to Kafka', async () => {
      const migrator = new KafkaDataMigrator()
      await migrator.migrateOpportunities()
      
      const messages = await consumeAllMessages('contracts.opportunities.migrated')
      const dbCount = await getOpportunityCount()
      
      expect(messages.length).toBe(dbCount)
    })

    it('should handle migration failures gracefully', async () => {
      // Test checkpoint recovery
    })
  })

  describe('ClickHouse Population', () => {
    it('should create analytics tables correctly', async () => {
      const populator = new ClickHousePopulator()
      await populator.createAnalyticsTables()
      
      const tables = await clickhouse.query('SHOW TABLES')
      expect(tables).toContain('opportunity_events')
    })
  })
})
```

### 4.2 Validation Checklist
```markdown
## Migration Validation Checklist

### Pre-Migration
- [ ] Full database backup completed
- [ ] Kafka topics created
- [ ] ClickHouse tables created
- [ ] Weaviate schemas registered
- [ ] Migration scripts tested in staging

### During Migration
- [ ] Monitor PostgreSQL load
- [ ] Check Kafka lag metrics
- [ ] Verify ClickHouse ingestion rate
- [ ] Monitor service health endpoints
- [ ] Track migration progress in dashboard

### Post-Migration
- [ ] Run consistency checker
- [ ] Validate event ordering
- [ ] Check application functionality
- [ ] Performance benchmarks met
- [ ] No data loss confirmed
```

## 5. Implementation Timeline

### Day 1 (4-5 hours)
1. **Morning**: Create schema migrations (2 hours)
   - Event sourcing tables
   - Service tracking columns
   - Migration state tracking

2. **Afternoon**: Start data sync scripts (2-3 hours)
   - Kafka event publisher
   - Basic ClickHouse setup

### Day 2 (4-5 hours)
1. **Morning**: Complete sync scripts (2 hours)
   - ClickHouse historical data
   - Weaviate embeddings

2. **Afternoon**: Rollback procedures (2-3 hours)
   - Service rollback script
   - Data consistency checker

### Day 3 (3-4 hours)
1. **Morning**: Testing & validation (2 hours)
   - Migration test suite
   - Integration tests

2. **Afternoon**: Documentation & cleanup (1-2 hours)
   - Update runbooks
   - Final validation

## 6. Risk Mitigation

### Data Loss Prevention
- Implement write-ahead logging
- Use transactional outbox pattern
- Regular checkpoint saves
- Parallel validation runs

### Performance Impact
- Run migrations during off-peak hours
- Use batch processing with configurable size
- Implement circuit breakers
- Monitor resource usage

### Rollback Strategy
- Keep original data untouched
- Version all schemas
- Maintain rollback scripts for each step
- Test rollback procedures in staging

## 7. Success Metrics

- **Zero data loss**: All records migrated successfully
- **Consistency**: <0.01% discrepancy rate
- **Performance**: Migration completes in <6 hours
- **Downtime**: Zero downtime for read operations
- **Validation**: All consistency checks pass

## Next Steps After Phase 4

1. Run migration in staging environment
2. Performance test with production-like data
3. Schedule production migration window
4. Prepare Phase 5: Production Deployment