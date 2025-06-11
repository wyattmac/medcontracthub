# Analytics Service

Cloud-native analytics microservice for the MedContractHub Hybrid Intelligence Platform.

## Overview

The Analytics Service is a high-performance, event-driven microservice that processes real-time analytics data from the MedContractHub platform. It uses Apache Kafka for event streaming, ClickHouse for time-series data storage, and Redis for caching.

## Architecture

- **Event Consumer**: Kafka consumer processing events from multiple topics
- **Data Writer**: ClickHouse writer for time-series analytics
- **Metrics Collector**: Prometheus metrics for monitoring
- **Health API**: Kubernetes-ready health check endpoints

## Features

- Real-time event processing
- Time-series data aggregation
- SLO monitoring and reporting
- Prometheus metrics integration
- Horizontal scalability
- Fault tolerance and error recovery

## Configuration

### Environment Variables

- `NODE_ENV`: Environment (development/staging/production)
- `PORT`: Service port (default: 8300)
- `METRICS_PORT`: Metrics port (default: 9090)
- `KAFKA_BROKERS`: Comma-separated list of Kafka brokers
- `KAFKA_CLIENT_ID`: Kafka client identifier
- `KAFKA_CONSUMER_GROUP`: Consumer group name
- `KAFKA_TOPICS`: Comma-separated list of topics to consume
- `CLICKHOUSE_HOST`: ClickHouse host
- `CLICKHOUSE_PORT`: ClickHouse port
- `CLICKHOUSE_DATABASE`: ClickHouse database name
- `REDIS_HOST`: Redis host
- `REDIS_PORT`: Redis port

## Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Start production mode
npm start
```

## Docker Build

```bash
# Build Docker image
docker build -t medcontracthub/analytics-service:latest .

# Run with Docker
docker run -p 8300:8300 -p 9090:9090 medcontracthub/analytics-service:latest
```

## Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/base/analytics-service/

# Check deployment status
kubectl get pods -n medcontracthub -l app=analytics-service

# View logs
kubectl logs -n medcontracthub -l app=analytics-service -f

# Access health endpoint (port-forward)
kubectl port-forward -n medcontracthub svc/analytics-service 8300:8300
curl http://localhost:8300/health
```

## Health Endpoints

- `/health` - Overall health status
- `/ready` - Readiness probe
- `/live` - Liveness probe
- `/metrics` - Prometheus metrics
- `/info` - Service information
- `/slo` - SLO status

## Event Topics

The service consumes events from the following Kafka topics:

- `contracts.opportunity.viewed` - Opportunity view events
- `contracts.opportunity.saved` - Opportunity save events
- `contracts.proposal.created` - Proposal creation events
- `contracts.proposal.updated` - Proposal update events
- `ai.document.processed` - Document processing events
- `user.activity` - User activity events

## SLOs (Service Level Objectives)

- **Data Freshness**: < 5 minutes
- **Query Latency P99**: < 500ms
- **Availability**: > 99.5%

## Monitoring

The service exposes Prometheus metrics on port 9090:

- `analytics_events_processed_total` - Total events processed
- `analytics_processing_duration_seconds` - Processing duration histogram
- `analytics_clickhouse_writes_total` - ClickHouse write operations
- `analytics_errors_total` - Error counter by type

## Troubleshooting

### Service Not Starting

1. Check Kafka connectivity:
   ```bash
   kubectl exec -it <pod-name> -- nc -zv kafka-cluster-kafka-bootstrap 9092
   ```

2. Verify ClickHouse connection:
   ```bash
   kubectl exec -it <pod-name> -- nc -zv clickhouse 8123
   ```

3. Check logs for errors:
   ```bash
   kubectl logs <pod-name> -n medcontracthub
   ```

### High Memory Usage

The service uses in-memory batching for performance. Adjust these settings:
- `BATCH_SIZE`: Reduce batch size
- `FLUSH_INTERVAL_MS`: Decrease flush interval

### Event Processing Lag

Monitor consumer lag:
```bash
kubectl exec -it kafka-0 -- kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --describe --group analytics-consumer-group
```

## Development

### Running Tests
```bash
npm test
npm run test:integration
npm run test:e2e
```

### Code Structure
```
src/
├── api/           # HTTP API endpoints
├── consumers/     # Kafka consumers
├── monitoring/    # Metrics and monitoring
├── processors/    # Event processors
├── utils/         # Utilities
├── writers/       # Data writers
└── index.ts       # Main entry point
```

## Contributing

1. Create feature branch
2. Make changes
3. Run tests
4. Submit PR

## License

Proprietary - MedContractHub