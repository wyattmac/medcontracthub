# Service Down Runbook

## Alert: ServiceDown

**Severity**: Critical  
**Team**: Platform

## Description

One or more microservices are not responding to health checks and are considered down.

## Impact

- Users may experience errors or degraded functionality
- Dependent services may fail or timeout
- Data processing may be delayed
- Business operations may be affected

## Detection

This alert fires when:
- Prometheus cannot scrape metrics from a service for > 2 minutes
- Health check endpoint returns non-200 status
- Service pods are not in Ready state

## Diagnosis Steps

### 1. Identify Affected Service

```bash
# Check which services are down
kubectl get pods -n medcontract-prod -l app=<service-name> -o wide

# Check deployment status
kubectl get deployment <service-name> -n medcontract-prod

# Check recent events
kubectl describe deployment <service-name> -n medcontract-prod
```

### 2. Check Pod Logs

```bash
# Get logs from all pods of the service
kubectl logs -n medcontract-prod -l app=<service-name> --tail=100

# Get previous container logs if pod restarted
kubectl logs -n medcontract-prod <pod-name> --previous

# Stream logs
kubectl logs -n medcontract-prod -l app=<service-name> -f
```

### 3. Check Resource Issues

```bash
# Check node resources
kubectl top nodes

# Check pod resources
kubectl top pods -n medcontract-prod -l app=<service-name>

# Check for resource limits
kubectl describe pod <pod-name> -n medcontract-prod | grep -A 5 "Limits\|Requests"
```

### 4. Check Dependencies

```bash
# Database connectivity
kubectl exec -n medcontract-prod <pod-name> -- nc -zv postgres-primary 5432

# Redis connectivity  
kubectl exec -n medcontract-prod <pod-name> -- nc -zv redis-cluster 6379

# Kafka connectivity
kubectl exec -n medcontract-prod <pod-name> -- nc -zv kafka-0 9092
```

## Resolution Steps

### Quick Fixes

#### 1. Restart Deployment
```bash
# Restart all pods
kubectl rollout restart deployment/<service-name> -n medcontract-prod

# Wait for rollout
kubectl rollout status deployment/<service-name> -n medcontract-prod
```

#### 2. Scale Deployment
```bash
# Scale down and up
kubectl scale deployment/<service-name> -n medcontract-prod --replicas=0
kubectl scale deployment/<service-name> -n medcontract-prod --replicas=5
```

#### 3. Delete Stuck Pods
```bash
# Force delete stuck pods
kubectl delete pod <pod-name> -n medcontract-prod --grace-period=0 --force
```

### Root Cause Fixes

#### Memory Issues
```bash
# Increase memory limits
kubectl set resources deployment/<service-name> -n medcontract-prod \
  --limits=memory=4Gi --requests=memory=2Gi
```

#### Image Issues
```bash
# Check image pull errors
kubectl describe pod <pod-name> -n medcontract-prod | grep -i "pull\|image"

# Update image pull secrets
kubectl create secret docker-registry regcred \
  --docker-server=registry.medcontracthub.com \
  --docker-username=$REGISTRY_USER \
  --docker-password=$REGISTRY_PASS \
  -n medcontract-prod
```

#### Configuration Issues
```bash
# Check ConfigMaps
kubectl get configmap -n medcontract-prod | grep <service-name>
kubectl describe configmap <configmap-name> -n medcontract-prod

# Check Secrets
kubectl get secrets -n medcontract-prod | grep <service-name>
```

#### Network Policy Issues
```bash
# Check network policies
kubectl get networkpolicy -n medcontract-prod | grep <service-name>

# Temporarily disable network policy (EMERGENCY ONLY)
kubectl delete networkpolicy <policy-name> -n medcontract-prod
```

## Service-Specific Issues

### OCR Service
- Check document processing queue in Redis
- Verify S3 access for document storage
- Check OCR engine memory usage

### AI Service
- Verify Weaviate cluster health
- Check AI API rate limits
- Monitor GPU usage if applicable

### Analytics Service
- Check ClickHouse connection
- Verify Kafka consumer lag
- Monitor aggregation job status

### Real-time Service
- Check WebSocket connections
- Verify Redis pub/sub
- Monitor connection pool

### Worker Service
- Check job queue status
- Verify external API connectivity
- Monitor cron job execution

## Escalation

If service remains down after 15 minutes:

1. **Page On-Call Engineer**: Use PagerDuty
2. **Contact Team Lead**: Check Slack #platform-oncall
3. **Engage Service Owner**: See service ownership matrix

## Prevention

1. **Resource Monitoring**: Set up alerts before limits are hit
2. **Dependency Health Checks**: Implement circuit breakers
3. **Gradual Rollouts**: Use canary deployments
4. **Load Testing**: Regular performance testing
5. **Chaos Engineering**: Planned failure injection

## Post-Incident

1. **Create Incident Report**: Use incident template
2. **Update Monitoring**: Add alerts for detected issues
3. **Update Runbook**: Document new failure modes
4. **Share Learning**: Present in team retrospective

## Related Documentation

- [Architecture Overview](../architecture.md)
- [Deployment Procedures](./deployment.md)
- [Monitoring Setup](./monitoring.md)
- [Service Dependencies](./dependencies.md)