# Cloud-Native Architecture Implementation Guide

## Overview

This document describes the cloud-native transformation of MedContractHub from a distributed monolith to a true microservices architecture with event-driven communication, independent deployments, and decentralized data management.

## Architecture Principles

### 1. **Decentralized Data Management**
Each service owns its data and exposes it only through APIs:
- **Analytics Service**: Exclusively uses ClickHouse for time-series analytics
- **AI Service**: Uses Weaviate for vector embeddings
- **Core Application**: Uses PostgreSQL for transactional data
- **Real-time Service**: Uses Redis for session state

### 2. **Event-Driven Architecture**
Services communicate asynchronously through Kafka:
```
Main App → Kafka → Analytics Service → ClickHouse
         ↘       ↗
          AI Service
```

### 3. **Independent Deployments**
Each service has its own:
- Git repository (or folder)
- CI/CD pipeline
- Docker image
- Helm chart
- Version number

## Implementation Details

### Event Schemas

All events use Avro schemas with schema registry for evolution:

```json
// opportunity-viewed.avsc
{
  "namespace": "com.medcontracthub.contracts",
  "type": "record",
  "name": "OpportunityViewedEvent",
  "fields": [
    {"name": "eventId", "type": "string"},
    {"name": "timestamp", "type": "long"},
    {"name": "opportunityId", "type": "string"},
    {"name": "userId", "type": "string"},
    // ... more fields
  ]
}
```

### Kafka Topics

Domain-driven topic naming:
- `contracts.opportunity.viewed`
- `contracts.opportunity.saved`
- `contracts.proposal.created`
- `ai.document.processed`
- `analytics.metrics.computed`

### Analytics Service Architecture

```
services/analytics-service/
├── src/
│   ├── consumers/        # Kafka consumers
│   ├── processors/       # Event processors
│   ├── writers/          # ClickHouse writers
│   ├── api/             # Health/metrics endpoints
│   └── monitoring/       # Prometheus metrics
├── migrations/          # ClickHouse schemas
├── helm/               # Kubernetes charts
└── Dockerfile          # Container definition
```

### ClickHouse Schema Design

Optimized for analytics queries:
```sql
-- Raw events table with TTL
CREATE TABLE opportunity_views (
    event_id String,
    timestamp DateTime64(3),
    opportunity_id String,
    user_id String,
    -- ... more columns
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, opportunity_id, user_id)
TTL timestamp + INTERVAL 90 DAY;

-- Materialized views for real-time aggregation
CREATE MATERIALIZED VIEW opportunity_metrics_1m
ENGINE = SummingMergeTree()
AS SELECT
    toStartOfMinute(timestamp) as minute,
    agency,
    count() as view_count,
    uniq(user_id) as unique_users
FROM opportunity_views
GROUP BY minute, agency;
```

## Service Communication Patterns

### 1. **Event Publishing (Fire-and-Forget)**
```typescript
// In main application
eventProducer.publishOpportunityViewed(userId, opportunityId, metadata)
  .catch(error => logger.error(error)); // Non-blocking
```

### 2. **Event Consumption (At-Least-Once)**
```typescript
// In Analytics Service
consumer.run({
  eachMessage: async ({ topic, message }) => {
    await processor.processEvent(topic, message);
    // Commit offset after successful processing
  }
});
```

### 3. **API Communication (Request-Response)**
```typescript
// Service-to-service API calls
const analyticsClient = new AnalyticsServiceClient({
  baseURL: 'http://analytics-service:8300',
  timeout: 3000,
  retry: { attempts: 3 }
});
```

## Deployment Strategy

### Independent CI/CD Pipeline

Each service has its own GitHub Actions workflow:
```yaml
# .github/workflows/analytics-service-ci.yml
name: Analytics Service CI/CD
on:
  push:
    paths:
      - 'services/analytics-service/**'
jobs:
  test:
    # Run tests
  build:
    # Build and push Docker image
  deploy:
    # Deploy to Kubernetes
```

### Canary Deployments

Progressive rollout with automated rollback:
```yaml
# 20% canary traffic
kubectl set image deployment/analytics-service-canary \
  analytics-service=image:new-version

# Monitor error rates
if [ $ERROR_RATE -lt 0.01 ]; then
  # Full rollout
  kubectl set image deployment/analytics-service \
    analytics-service=image:new-version
fi
```

### Service Mesh Configuration

Istio for traffic management:
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
spec:
  http:
  - match:
    - headers:
        x-version:
          exact: v2
    route:
    - destination:
        host: analytics-service
        subset: v2
      weight: 20  # Canary
```

## Monitoring & Observability

### SLOs (Service Level Objectives)
```typescript
slos: {
  dataFreshnessMinutes: 5,     // Events processed within 5 min
  queryLatencyP99Ms: 500,      // 99th percentile < 500ms
  availabilityTarget: 0.995    // 99.5% uptime
}
```

### Metrics Collection
```typescript
// Custom business metrics
metrics.incrementCounter('opportunity_views_total', {
  agency: event.agency,
  source: event.viewSource
});

// Technical metrics
metrics.recordHistogram('event_processing_duration_ms', duration, {
  topic: topic
});
```

### Health Checks
- `/health` - Overall service health
- `/ready` - Ready to accept traffic
- `/metrics` - Prometheus metrics
- `/slo` - SLO status

## Security Considerations

### Zero-Trust Networking
```yaml
# Network policy - only allow specific connections
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
spec:
  podSelector:
    matchLabels:
      app: analytics-service
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
```

### Secret Management
- Kubernetes secrets for sensitive data
- Automated rotation with CronJobs
- External secrets operator for cloud providers

## Cost Optimization

### Resource Isolation
```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "4Gi"
    cpu: "2000m"
```

### Autoscaling
```yaml
# Horizontal Pod Autoscaler
spec:
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

### Data Retention
```sql
-- Automatic data cleanup
TTL timestamp + INTERVAL 90 DAY;

-- Aggregated data kept longer
retention_policies:
  raw_events: "7d"
  1m_aggregates: "30d"
  1h_aggregates: "1y"
```

## Migration Checklist

- [x] Set up Kafka infrastructure
- [x] Create event schemas
- [x] Implement event producers
- [x] Build Analytics Service consumer
- [x] Create ClickHouse schema
- [x] Set up independent CI/CD
- [x] Implement monitoring/SLOs
- [ ] Load test the system
- [ ] Migrate remaining services

## Next Services to Migrate

1. **OCR Service** (Week 3-4)
   - Move to S3 + DynamoDB
   - Event-driven processing
   - Independent scaling

2. **AI Service** (Week 5-6)
   - Weaviate exclusive usage
   - Model versioning
   - A/B testing infrastructure

3. **Real-time Service** (Week 7-8)
   - WebSocket management
   - Redis for state
   - Horizontal scaling

## Benefits Achieved

1. **Independent Deployability**: Analytics Service can be deployed without touching other services
2. **Failure Isolation**: Analytics outage doesn't affect core functionality
3. **Elastic Scalability**: Each service scales based on its own load
4. **Team Autonomy**: Analytics team can choose their tech stack
5. **Cost Efficiency**: Pay only for resources each service actually uses

## Common Pitfalls Avoided

- ❌ No shared databases between services
- ❌ No synchronous service chains
- ❌ No shared libraries with business logic
- ❌ No coordinated deployments
- ❌ No direct database access across boundaries

## Conclusion

This transformation demonstrates true cloud-native principles:
- **Decentralized data** with API-only access
- **Event-driven** asynchronous communication
- **Independent deployments** with separate pipelines
- **Elastic scalability** per service
- **Failure isolation** through circuit breakers
- **Automated everything** from testing to deployment

The Analytics Service serves as the template for migrating remaining services to achieve a fully cloud-native architecture.