# OCR Service Multi-Level Cache Deployment Guide

## Overview

This guide covers the deployment of the enhanced OCR service with multi-level caching and vector search capabilities. The new architecture provides:

- **L1 Cache (Hot)**: In-memory Redis cache with 24-hour TTL for frequently accessed documents
- **L2 Cache (Warm)**: Persistent Redis cache with 7-day TTL for moderately accessed documents
- **L3 Cache (Cold)**: PostgreSQL permanent storage
- **Vector Search**: Weaviate integration for semantic document matching
- **Contract Family Tracking**: Automatic detection and linking of contract amendments

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client    │────▶│ Kong Gateway │────▶│ OCR Service  │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
                    ▼                            ▼                            ▼
            ┌───────────────┐           ┌───────────────┐           ┌──────────────┐
            │  L1 Cache     │           │  L2 Cache     │           │  L3 Storage  │
            │  (Redis Hot)  │           │ (Redis Warm)  │           │ (PostgreSQL) │
            │  TTL: 24h     │           │  TTL: 7d      │           │  Permanent   │
            └───────────────┘           └───────────────┘           └──────────────┘
                                                 │
                                        ┌────────┴────────┐
                                        │  Vector Search  │
                                        │   (Weaviate)    │
                                        └─────────────────┘
```

## Prerequisites

- Kubernetes cluster (1.24+)
- Docker registry access
- kubectl configured
- Helm 3.x installed
- At least 10GB available storage
- 8GB RAM available for services

## Deployment Steps

### 1. Quick Deployment

Use the provided deployment script for automated deployment:

```bash
./scripts/deploy-ocr-updates.sh
```

### 2. Manual Deployment

#### Step 1: Build and Push Docker Image

```bash
cd services/ocr-service
docker build -t medcontracthub/ocr-service:2.0.0 .
docker tag medcontracthub/ocr-service:2.0.0 localhost:5001/ocr-service:2.0.0
docker push localhost:5001/ocr-service:2.0.0
```

#### Step 2: Deploy Redis Cache Instances

```bash
# Deploy L1 cache (hot data)
kubectl apply -f k8s/base/redis/redis-l1-cache.yaml

# Deploy L2 cache (warm data)
kubectl apply -f k8s/base/redis/redis-l2-cache.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l app=redis-l1-cache -n medcontracthub --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis-l2-cache -n medcontracthub --timeout=120s
```

#### Step 3: Update OCR Service

```bash
# Apply configuration
kubectl apply -f k8s/base/ocr-service/configmap.yaml

# Deploy OCR service v2.0.0
kubectl apply -f k8s/base/ocr-service/deployment.yaml

# Monitor rollout
kubectl rollout status deployment/ocr-service -n medcontracthub
```

#### Step 4: Run Database Migrations

```bash
# Backup database first
kubectl exec -it postgres-primary-0 -n medcontracthub -- \
  pg_dump -U postgres medcontracthub > backup-$(date +%Y%m%d).sql

# Run migrations
npm run db:migrate
```

#### Step 5: Update Monitoring

```bash
# Apply monitoring configuration
kubectl apply -f k8s/base/monitoring/prometheus-microservices-config.yaml
kubectl apply -f k8s/base/monitoring/cache-alerts.yaml
kubectl apply -k k8s/base/monitoring/
```

## Configuration

### Environment Variables

The OCR service uses the following cache-related environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_L1_URL` | L1 cache connection URL | `redis://redis-l1-cache:6379/0` |
| `REDIS_L2_URL` | L2 cache connection URL | `redis://redis-l2-cache:6379/0` |
| `WEAVIATE_URL` | Vector search URL | `http://weaviate:8080` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |

### Cache Configuration

L1 Cache (Hot):
- Memory: 2GB
- TTL: 24 hours
- Eviction: LRU (Least Recently Used)
- Persistence: Disabled

L2 Cache (Warm):
- Memory: 4GB
- TTL: 7 days
- Eviction: LFU (Least Frequently Used)
- Persistence: RDB snapshots

## Monitoring

### Access Grafana Dashboard

```bash
kubectl port-forward svc/grafana 3000:3000 -n monitoring
```

Navigate to: http://localhost:3000
Dashboard: "Multi-Level Cache Performance"

### Monitor Cache Performance

```bash
# Real-time monitoring
./scripts/monitor-cache-performance.sh

# Check cache metrics
kubectl port-forward svc/ocr-service 8100:8100 -n medcontracthub
curl http://localhost:8100/cache/metrics | jq .
```

### View Logs

```bash
# OCR service logs
kubectl logs -f -l app=ocr-service -n medcontracthub

# Redis cache logs
kubectl logs -f -l app=redis-l1-cache -n medcontracthub
kubectl logs -f -l app=redis-l2-cache -n medcontracthub
```

## Testing

### Functional Testing

```bash
# Run cache functionality tests
./scripts/test-cache-functionality.sh
```

### Performance Testing

```bash
# Test cache hit rates
curl -X POST http://localhost:8100/process/url \
  -H "Content-Type: application/json" \
  -d '{"document_url": "https://example.com/test.pdf", "model": "pixtral-12b-latest"}'

# Second request should be much faster (cache hit)
```

## Troubleshooting

### Common Issues

1. **Low Cache Hit Rate**
   - Check if documents are being properly indexed
   - Verify Redis has sufficient memory
   - Monitor eviction rates

2. **High Latency**
   - Check Redis connection latency
   - Verify network policies
   - Monitor CPU/memory usage

3. **Vector Search Not Working**
   - Ensure Weaviate is running
   - Check schema initialization
   - Verify embedding model loaded

### Debug Commands

```bash
# Check pod status
kubectl get pods -n medcontracthub | grep -E "ocr|redis|weaviate"

# Describe problematic pod
kubectl describe pod <pod-name> -n medcontracthub

# Check Redis memory
kubectl exec -it redis-l1-cache-0 -n medcontracthub -- redis-cli info memory

# Test Weaviate connection
kubectl exec -it deployment/ocr-service -n medcontracthub -- \
  curl http://weaviate:8080/v1/.well-known/ready
```

## Rollback Procedure

If issues occur, rollback to previous version:

```bash
# Rollback OCR service
kubectl set image deployment/ocr-service \
  ocr-service=medcontracthub/ocr-service:1.0.0 -n medcontracthub

# Restore database if needed
kubectl exec -it postgres-primary-0 -n medcontracthub -- \
  psql -U postgres medcontracthub < backup-20240115.sql

# Remove cache services if needed
kubectl delete -f k8s/base/redis/redis-l1-cache.yaml
kubectl delete -f k8s/base/redis/redis-l2-cache.yaml
```

## Performance Metrics

Expected performance after deployment:

- **L1 Cache Hit Rate**: >70% after warm-up
- **L2 Cache Hit Rate**: >50% for repeated documents
- **Overall Hit Rate**: >80% for typical workload
- **P95 Latency**: <500ms for cached requests
- **Vector Search**: <200ms for similarity queries

## Alerts

The following alerts are configured:

| Alert | Threshold | Severity |
|-------|-----------|----------|
| L1CacheHitRateLow | <70% for 5m | Warning |
| L2CacheHitRateLow | <50% for 10m | Warning |
| OverallCacheHitRateCritical | <50% for 10m | Critical |
| CacheMemoryHigh | >90% usage | Warning |
| HighCacheEvictionRate | >10/sec | Warning |

## Maintenance

### Regular Tasks

1. **Weekly**: Review cache hit rates and adjust TTLs if needed
2. **Monthly**: Analyze eviction patterns and resize caches if necessary
3. **Quarterly**: Review vector search performance and retrain embeddings

### Cache Management

```bash
# Clear L1 cache (if needed)
kubectl exec -it redis-l1-cache-0 -n medcontracthub -- redis-cli FLUSHDB

# Monitor cache size
kubectl exec -it redis-l1-cache-0 -n medcontracthub -- redis-cli DBSIZE
kubectl exec -it redis-l2-cache-0 -n medcontracthub -- redis-cli DBSIZE

# Analyze cache keys
kubectl exec -it redis-l1-cache-0 -n medcontracthub -- redis-cli --scan
```

## Support

For issues or questions:
1. Check logs and metrics first
2. Review troubleshooting section
3. Contact the platform team
4. Create an issue in the repository