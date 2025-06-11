# Runbook: High Error Rate Alert

## Alert: MedContractHubHighErrorRate

### Overview
This alert fires when the error rate exceeds 14.4x the normal burn rate, threatening our 99.9% uptime SLO.

### Impact
- Users experiencing failures
- Potential revenue loss
- SLO budget consumption

### Severity: CRITICAL (Page)

## Investigation Steps

### 1. Immediate Actions (First 5 minutes)

```bash
# Check current error rate
kubectl exec -it deployment/prometheus -n monitoring -- \
  promtool query instant \
  'sum(rate(medcontracthub_errors_total[5m])) / sum(rate(medcontracthub_requests_total[5m]))'

# View error logs
kubectl logs -n medcontracthub -l app.kubernetes.io/name=medcontracthub --tail=100 | grep -i error

# Check service health
kubectl get pods -n medcontracthub -o wide
kubectl get hpa -n medcontracthub
```

### 2. Identify Error Source

```bash
# Error breakdown by service
kubectl exec -it deployment/prometheus -n monitoring -- \
  promtool query instant \
  'sum by (service, error_type) (rate(medcontracthub_errors_total[5m]))'

# Check specific service logs
SERVICE_NAME=ai-service  # Replace with problematic service
kubectl logs -n medcontracthub -l app=$SERVICE_NAME --tail=200

# View recent deployments
kubectl get events -n medcontracthub --sort-by='.lastTimestamp' | head -20
```

### 3. Common Causes & Solutions

#### Database Connection Issues
```bash
# Check database connectivity
kubectl exec -it deployment/postgres-primary -n medcontracthub -- \
  pg_isready -h localhost -p 5432

# Check connection pool
kubectl logs -n medcontracthub -l app=medcontracthub-app | grep -i "connection pool"

# Restart connection pools if needed
kubectl rollout restart deployment/medcontracthub-app -n medcontracthub
```

#### Memory/Resource Issues
```bash
# Check resource usage
kubectl top pods -n medcontracthub

# Check for OOM kills
kubectl get events -n medcontracthub | grep -i "oom"

# Scale up if needed
kubectl scale deployment/ai-service --replicas=10 -n medcontracthub
```

#### External API Failures
```bash
# Check AI API status
curl -s https://api.openai.com/v1/engines | jq .

# Check rate limits
kubectl logs -n medcontracthub -l app=ai-service | grep -i "rate limit"

# Enable circuit breaker if needed
kubectl set env deployment/ai-service CIRCUIT_BREAKER_ENABLED=true -n medcontracthub
```

### 4. Mitigation Actions

#### Quick Rollback (if recent deployment)
```bash
# Check recent deployments
kubectl rollout history deployment/medcontracthub-app -n medcontracthub

# Rollback to previous version
kubectl rollout undo deployment/medcontracthub-app -n medcontracthub

# Monitor rollback status
kubectl rollout status deployment/medcontracthub-app -n medcontracthub
```

#### Enable Degraded Mode
```bash
# Disable non-critical features
kubectl set env deployment/medcontracthub-app \
  FEATURE_AI_RECOMMENDATIONS=false \
  FEATURE_ADVANCED_ANALYTICS=false \
  -n medcontracthub
```

#### Traffic Management
```bash
# Reduce traffic to problematic service
kubectl patch virtualservice medcontracthub-app -n medcontracthub --type='json' \
  -p='[{"op": "replace", "path": "/spec/http/0/route/0/weight", "value": 50}]'
```

### 5. Communication

1. **Update Status Page**: https://status.medcontracthub.com
2. **Notify Stakeholders**:
   - Engineering: #platform-incidents
   - Customer Success: #customer-alerts
   - Leadership: Via PagerDuty escalation

3. **Template Message**:
```
We are currently experiencing elevated error rates affecting some users.
Impact: [Describe impact]
ETA: [Estimated resolution time]
Updates: https://status.medcontracthub.com
```

### 6. Post-Incident

1. **Document timeline** in incident report
2. **Calculate SLO impact**: 
   ```bash
   # Minutes of downtime
   # Error budget consumed
   ```
3. **Schedule postmortem** within 24 hours
4. **Create action items** to prevent recurrence

## Escalation

- **15 minutes**: Page secondary on-call
- **30 minutes**: Page engineering manager
- **45 minutes**: Page VP of Engineering
- **60 minutes**: Activate incident command

## Related Dashboards

- [SLO Dashboard](https://grafana.medcontracthub.com/d/medcontract-slo)
- [Error Analysis](https://grafana.medcontracthub.com/d/errors)
- [Service Map](https://grafana.medcontracthub.com/d/service-map)

## Tools

- Grafana: https://grafana.medcontracthub.com
- Kibana: https://kibana.medcontracthub.com
- Jaeger: https://jaeger.medcontracthub.com