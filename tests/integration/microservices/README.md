# MedContractHub Microservices Integration Tests

This directory contains integration tests for the MedContractHub microservices architecture.

## Structure

- `setup.ts` - Test framework setup with helpers for all services
- `scenarios/` - End-to-end test scenarios
  - `document-processing-flow.test.ts` - OCR → AI → Storage pipeline
  - `ai-analysis-pipeline.test.ts` - Multi-model AI orchestration
  - `real-time-collaboration.test.ts` - WebSocket collaboration tests
  - `analytics-event-flow.test.ts` - Event tracking and analytics
- `performance/` - Load and stress tests
  - `load-test-ocr-service.ts` - OCR service performance testing
  - `stress-test-kafka-pipeline.ts` - Event streaming stress test
  - `websocket-concurrent-users.ts` - Real-time service load test

## Prerequisites

1. All microservices must be running (use Docker Compose or Kubernetes)
2. Kafka, Redis, PostgreSQL, and other dependencies must be available
3. Environment variables must be configured

## Running Tests

```bash
# Install dependencies
cd tests/integration/microservices
npm install

# Run all integration tests
npm test

# Run specific test suite
npm test scenarios/document-processing-flow.test.ts

# Run performance tests
npm run test:performance

# Watch mode for development
npm run test:watch
```

## Environment Setup

### Using Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.yml up -d

# Wait for services to be ready
./scripts/wait-for-services.sh

# Run tests
npm test
```

### Using Kubernetes

```bash
# Deploy to local cluster
kubectl apply -k k8s/overlays/dev/

# Port forward Kong gateway
kubectl port-forward svc/kong-proxy 8080:80 -n medcontracthub

# Run tests
KONG_GATEWAY_URL=http://localhost:8080 npm test
```

## Writing New Tests

1. Import the test setup:
```typescript
import { testSetup, withAuth } from '../setup'
```

2. Wait for required services:
```typescript
beforeAll(async () => {
  await testSetup.waitForServices(['gateway', 'ocr', 'ai'])
})
```

3. Use authentication wrapper:
```typescript
await withAuth(async (token, user) => {
  // Your test code here
})
```

4. Clean up after tests:
```typescript
afterAll(async () => {
  await testSetup.cleanup()
})
```

## Performance Testing

### OCR Service Load Test

```bash
# Run with default settings
npm run test:performance

# Custom parameters
CONCURRENT_USERS=50 DURATION=300 npm run test:performance
```

### Monitoring During Tests

- Grafana dashboards: http://localhost:3000
- Kafka UI: http://localhost:8080
- Jaeger tracing: http://localhost:16686

## Troubleshooting

### Services Not Ready

```bash
# Check service health
curl http://localhost:8080/health

# View logs
docker-compose logs -f <service-name>

# Restart specific service
docker-compose restart <service-name>
```

### Kafka Connection Issues

```bash
# Check Kafka topics
docker exec -it kafka kafka-topics.sh --list --bootstrap-server localhost:9092

# Monitor consumer groups
docker exec -it kafka kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
```

### Test Timeouts

Increase timeout in specific tests:
```typescript
it('should process large document', async () => {
  // test code
}, 120000) // 2 minute timeout
```

## CI/CD Integration

```yaml
# .github/workflows/integration-tests.yml
- name: Run Integration Tests
  run: |
    cd tests/integration/microservices
    npm ci
    npm test
  env:
    KONG_GATEWAY_URL: ${{ secrets.KONG_GATEWAY_URL }}
```