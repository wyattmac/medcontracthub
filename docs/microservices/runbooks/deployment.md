# Deployment Procedures Runbook

## Overview

This runbook covers deployment procedures for MedContractHub microservices including normal deployments, rollbacks, and emergency procedures.

## Pre-Deployment Checklist

### 1. Verify Prerequisites
- [ ] All tests passing in CI/CD pipeline
- [ ] Security scans completed (Trivy, Snyk)
- [ ] Performance benchmarks within acceptable range
- [ ] Database migrations reviewed and tested
- [ ] Rollback plan documented
- [ ] Communication sent to stakeholders

### 2. Environment Validation
```bash
# Check cluster health
kubectl get nodes
kubectl top nodes

# Verify namespace resources
kubectl get all -n medcontract-prod

# Check PVC space
kubectl get pvc -n medcontract-prod

# Verify secrets are up to date
kubectl get secrets -n medcontract-prod
```

## Standard Deployment Procedures

### 1. Single Service Deployment

```bash
# Set variables
SERVICE_NAME="ai-service"
VERSION="v1.2.3"
NAMESPACE="medcontract-prod"

# Tag and push image
docker tag medcontracthub/${SERVICE_NAME}:latest \
  registry.medcontracthub.com/${SERVICE_NAME}:${VERSION}
docker push registry.medcontracthub.com/${SERVICE_NAME}:${VERSION}

# Update deployment
kubectl set image deployment/${SERVICE_NAME} \
  ${SERVICE_NAME}=registry.medcontracthub.com/${SERVICE_NAME}:${VERSION} \
  -n ${NAMESPACE}

# Watch rollout
kubectl rollout status deployment/${SERVICE_NAME} -n ${NAMESPACE}
```

### 2. Multi-Service Coordinated Deployment

```bash
# Use the automated workflow
gh workflow run microservices-deploy.yml \
  -f environment=production \
  -f services='["ocr-service","ai-service"]' \
  -f strategy=rolling
```

### 3. Database Migration Deployment

```bash
# First, create backup
kubectl exec -n medcontract-prod postgres-primary-0 -- \
  pg_dump -U postgres medcontracthub > backup-$(date +%Y%m%d-%H%M%S).sql

# Apply migration
kubectl apply -f migrations/migration-v${VERSION}.yaml -n medcontract-prod

# Verify migration
kubectl logs job/migration-v${VERSION} -n medcontract-prod

# Deploy application updates
kubectl apply -k k8s/overlays/prod/
```

## Deployment Strategies

### 1. Rolling Deployment (Default)

```bash
# Configure rolling update
kubectl patch deployment ${SERVICE_NAME} -n ${NAMESPACE} -p '
{
  "spec": {
    "strategy": {
      "type": "RollingUpdate",
      "rollingUpdate": {
        "maxSurge": 1,
        "maxUnavailable": 0
      }
    }
  }
}'

# Deploy
kubectl set image deployment/${SERVICE_NAME} \
  ${SERVICE_NAME}=registry.medcontracthub.com/${SERVICE_NAME}:${VERSION} \
  -n ${NAMESPACE}
```

### 2. Canary Deployment

```bash
# Deploy canary (10% traffic)
gh workflow run progressive-rollout.yml \
  -f strategy=canary \
  -f service=${SERVICE_NAME} \
  -f version=${VERSION} \
  -f canary_percentage=10

# Monitor metrics (wait 10 minutes)
kubectl exec -n monitoring prometheus-0 -- \
  promtool query instant \
  'rate(http_requests_total{job="'${SERVICE_NAME}'-canary",status=~"5.."}[5m])'

# Increase canary traffic
flagger promote ${SERVICE_NAME} -n ${NAMESPACE}

# Complete rollout
flagger promote ${SERVICE_NAME} -n ${NAMESPACE} --skip-analysis
```

### 3. Blue-Green Deployment

```bash
# Deploy to green environment
kubectl apply -f deployments/${SERVICE_NAME}-green.yaml -n ${NAMESPACE}

# Wait for green to be ready
kubectl wait --for=condition=ready pod \
  -l app=${SERVICE_NAME},version=green -n ${NAMESPACE}

# Switch traffic to green
kubectl patch service ${SERVICE_NAME} -n ${NAMESPACE} -p \
  '{"spec":{"selector":{"version":"green"}}}'

# Verify traffic switch
curl -s https://api.medcontracthub.com/health | jq .version

# Remove blue deployment
kubectl delete deployment ${SERVICE_NAME}-blue -n ${NAMESPACE}
```

## Rollback Procedures

### 1. Immediate Rollback

```bash
# Check rollout history
kubectl rollout history deployment/${SERVICE_NAME} -n ${NAMESPACE}

# Rollback to previous version
kubectl rollout undo deployment/${SERVICE_NAME} -n ${NAMESPACE}

# Rollback to specific revision
kubectl rollout undo deployment/${SERVICE_NAME} \
  --to-revision=3 -n ${NAMESPACE}

# Verify rollback
kubectl rollout status deployment/${SERVICE_NAME} -n ${NAMESPACE}
```

### 2. Canary Rollback

```bash
# Abort canary deployment
flagger abort ${SERVICE_NAME} -n ${NAMESPACE}

# Verify primary is serving all traffic
kubectl get canary ${SERVICE_NAME} -n ${NAMESPACE}
```

### 3. Database Rollback

```bash
# Stop application pods to prevent data corruption
kubectl scale deployment --all --replicas=0 -n ${NAMESPACE}

# Restore database backup
kubectl exec -i -n medcontract-prod postgres-primary-0 -- \
  psql -U postgres medcontracthub < backup-${BACKUP_DATE}.sql

# Apply reverse migration if available
kubectl apply -f migrations/rollback-v${VERSION}.yaml -n ${NAMESPACE}

# Restart application with previous version
kubectl set image deployment --all \
  *=registry.medcontracthub.com/*:${PREVIOUS_VERSION} \
  -n ${NAMESPACE}

# Scale back up
kubectl scale deployment --all --replicas=3 -n ${NAMESPACE}
```

## Emergency Procedures

### 1. Emergency Service Isolation

```bash
# Immediately remove service from load balancer
kubectl patch service ${SERVICE_NAME} -n ${NAMESPACE} -p \
  '{"spec":{"selector":{"isolated":"true"}}}'

# Scale down problematic deployment
kubectl scale deployment ${SERVICE_NAME} --replicas=0 -n ${NAMESPACE}

# Deploy emergency static response
kubectl apply -f emergency/${SERVICE_NAME}-maintenance.yaml -n ${NAMESPACE}
```

### 2. Circuit Breaker Activation

```bash
# Configure Istio circuit breaker
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: ${SERVICE_NAME}-circuit-breaker
  namespace: ${NAMESPACE}
spec:
  host: ${SERVICE_NAME}
  trafficPolicy:
    outlierDetection:
      consecutiveErrors: 1
      interval: 1s
      baseEjectionTime: 3m
      maxEjectionPercent: 100
EOF
```

### 3. Emergency Cache Activation

```bash
# Enable aggressive caching
kubectl set env deployment/medcontracthub-app \
  CACHE_MODE=aggressive \
  CACHE_TTL=3600 \
  -n ${NAMESPACE}

# Warm cache with critical data
kubectl exec -n ${NAMESPACE} deploy/worker-service -- \
  npm run cache:warm
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Service health
for service in ocr-service ai-service analytics-service realtime-service worker-service; do
  echo "Checking $service..."
  kubectl exec -n ${NAMESPACE} deploy/${service} -- wget -qO- localhost:8080/health
done

# External health check
curl -s https://api.medcontracthub.com/health | jq .

# Database connectivity
kubectl exec -n ${NAMESPACE} deploy/medcontracthub-app -- \
  npm run db:health
```

### 2. Smoke Tests

```bash
# Run automated smoke tests
kubectl apply -f tests/smoke-tests-job.yaml -n ${NAMESPACE}
kubectl wait --for=condition=complete job/smoke-tests -n ${NAMESPACE}
kubectl logs job/smoke-tests -n ${NAMESPACE}

# Manual smoke test
curl -X POST https://api.medcontracthub.com/api/opportunities/search \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keywords": "medical equipment"}'
```

### 3. Performance Validation

```bash
# Check response times
kubectl exec -n monitoring prometheus-0 -- \
  promtool query instant \
  'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'

# Verify no increase in errors
kubectl exec -n monitoring prometheus-0 -- \
  promtool query instant \
  'rate(http_requests_total{status=~"5.."}[5m])'

# Check resource utilization
kubectl top pods -n ${NAMESPACE}
```

## Deployment Windows

### Production Deployment Schedule
- **Regular Deployments**: Tuesday/Thursday 10 AM - 2 PM EST
- **Emergency Patches**: Any time with approval
- **Major Releases**: Saturday 6 AM - 10 AM EST

### Deployment Freeze Periods
- **Year-end**: December 15 - January 5
- **Major Holidays**: 2 days before and after
- **High Traffic Events**: During government contracting deadlines

## Communication Plan

### Pre-Deployment
```bash
# Send notification
curl -X POST $SLACK_WEBHOOK_URL -d @- <<EOF
{
  "text": "🚀 Deployment starting for ${SERVICE_NAME} v${VERSION}",
  "attachments": [{
    "color": "warning",
    "fields": [
      {"title": "Service", "value": "${SERVICE_NAME}", "short": true},
      {"title": "Version", "value": "${VERSION}", "short": true},
      {"title": "Strategy", "value": "${STRATEGY}", "short": true},
      {"title": "Runbook", "value": "https://docs.medcontracthub.com/runbooks/deployment", "short": true}
    ]
  }]
}
EOF
```

### Post-Deployment
```bash
# Success notification
curl -X POST $SLACK_WEBHOOK_URL -d '
{
  "text": "✅ Deployment completed successfully",
  "attachments": [{
    "color": "good",
    "fields": [
      {"title": "Status", "value": "Success", "short": true},
      {"title": "Duration", "value": "'$DEPLOYMENT_TIME' minutes", "short": true}
    ]
  }]
}'
```

## Troubleshooting Common Issues

### Image Pull Errors
```bash
# Check image exists
docker manifest inspect registry.medcontracthub.com/${SERVICE_NAME}:${VERSION}

# Verify pull secret
kubectl get secret regcred -n ${NAMESPACE} -o yaml

# Test pull manually
kubectl run test-pull --image=registry.medcontracthub.com/${SERVICE_NAME}:${VERSION} \
  --rm -it --restart=Never -n ${NAMESPACE}
```

### Resource Constraints
```bash
# Check node resources
kubectl describe nodes | grep -A 5 "Allocated resources"

# Find large pods
kubectl top pods -n ${NAMESPACE} --sort-by=memory

# Evict non-critical pods if needed
kubectl drain node-name --ignore-daemonsets --delete-emptydir-data
```

### Configuration Issues
```bash
# Verify ConfigMaps
kubectl get cm -n ${NAMESPACE} -o yaml | grep -A 10 ${SERVICE_NAME}

# Check environment variables
kubectl exec deploy/${SERVICE_NAME} -n ${NAMESPACE} -- env | sort

# Validate secrets mounting
kubectl describe pod -l app=${SERVICE_NAME} -n ${NAMESPACE} | grep -A 5 "Mounts:"
```

## References

- [CI/CD Pipeline Documentation](../ci-cd/README.md)
- [Architecture Overview](../architecture.md)
- [Service Dependencies](./dependencies.md)
- [Monitoring Guide](./monitoring.md)
- [Emergency Contacts](./contacts.md)