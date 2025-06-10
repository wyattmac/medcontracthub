# MedContractHub Kubernetes Configuration

This directory contains the complete Kubernetes configuration for deploying the MedContractHub Hybrid Intelligence Platform.

## Architecture Overview

The platform consists of:
- **Microservices**: AI Service, Analytics Service, Realtime Service, Worker Service
- **Data Layer**: PostgreSQL (primary-replica), Redis Cluster, Weaviate (vector DB), ClickHouse (analytics)
- **Infrastructure**: Kong API Gateway, NGINX Ingress, Istio Service Mesh, Prometheus/Grafana monitoring

## Directory Structure

```
k8s/
├── base/                    # Base configurations for all environments
│   ├── app/                # Main application
│   ├── ai-service/         # AI/ML orchestration service
│   ├── analytics-service/  # Real-time analytics
│   ├── realtime-service/   # WebSocket collaboration
│   ├── worker-service/     # Background job processing
│   ├── weaviate/          # Vector database
│   ├── clickhouse/        # Time-series analytics
│   ├── postgres-primary/  # PostgreSQL primary
│   ├── postgres-replica/  # PostgreSQL replicas
│   ├── ingress/           # Ingress controller configs
│   └── monitoring/        # Prometheus, Grafana, Jaeger
├── overlays/              # Environment-specific configurations
│   ├── dev/              # Development environment
│   ├── staging/          # Staging environment
│   └── prod/             # Production environment
├── helm/                 # Helm charts (if needed)
└── scripts/              # Setup and utility scripts
```

## Quick Start

### Prerequisites
- Kubernetes cluster (1.28+)
- kubectl configured
- Helm 3.x installed
- 50+ GB storage available
- LoadBalancer support (for Ingress)

### Complete Setup

```bash
# Run the complete setup script
./k8s/scripts/setup-complete-k8s.sh
```

This will:
1. Create namespaces
2. Install Ingress controller with TLS
3. Set up Sealed Secrets for secret management
4. Deploy all microservices
5. Configure databases
6. Set up monitoring

### Manual Setup Steps

1. **Create environment file**:
   ```bash
   cp .env.local k8s/base/app/secrets.env
   ```

2. **Install infrastructure**:
   ```bash
   # Ingress Controller
   ./k8s/scripts/setup-ingress.sh
   
   # Sealed Secrets
   ./k8s/scripts/setup-sealed-secrets.sh
   ```

3. **Deploy to development**:
   ```bash
   kubectl apply -k k8s/overlays/dev/
   ```

4. **Deploy to staging**:
   ```bash
   kubectl apply -k k8s/overlays/staging/
   ```

5. **Deploy to production**:
   ```bash
   kubectl apply -k k8s/overlays/prod/
   ```

## Service Endpoints

### Development
- App: http://localhost:3000 (port-forward)
- API Gateway: http://localhost:8080 (port-forward)
- AI Service: http://localhost:8200
- Analytics: http://localhost:8300
- WebSocket: ws://localhost:8400

### Production
- App: https://medcontracthub.com
- API: https://api.medcontracthub.com
- WebSocket: wss://ws.medcontracthub.com
- Analytics: https://analytics.medcontracthub.com

## Secrets Management

We use Sealed Secrets for secure secret storage in Git:

```bash
# Create a secret
kubectl create secret generic my-secret \
  --from-literal=key=value \
  --dry-run=client -o yaml > my-secret.yaml

# Seal it
./k8s/scripts/seal-secret.sh my-secret.yaml my-sealed-secret.yaml

# Apply the sealed secret
kubectl apply -f my-sealed-secret.yaml
```

## Monitoring

Access monitoring dashboards:
```bash
# Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n monitoring

# Grafana (admin/admin)
kubectl port-forward svc/grafana 3000:3000 -n monitoring

# Jaeger
kubectl port-forward svc/jaeger 16686:16686 -n monitoring
```

## Scaling

Services auto-scale based on metrics:
- **AI Service**: CPU, memory, inference queue depth
- **Analytics Service**: CPU, Kafka consumer lag
- **Realtime Service**: WebSocket connections
- **Worker Service**: Job queue depth

Manual scaling:
```bash
# Scale a deployment
kubectl scale deployment/ai-service --replicas=10 -n medcontracthub

# Scale a StatefulSet
kubectl scale statefulset/postgres-replica --replicas=5 -n medcontracthub
```

## Backup & Recovery

### Database Backups
```bash
# PostgreSQL backup
kubectl exec -it postgres-primary-0 -n medcontracthub -- \
  pg_dump -U postgres medcontracthub > backup.sql

# ClickHouse backup
kubectl exec -it clickhouse-0 -n medcontracthub -- \
  clickhouse-client --query="BACKUP DATABASE medcontract_analytics TO '/backup/'"
```

### Persistent Volume Backups
Use Velero or your cloud provider's snapshot features.

## Troubleshooting

### Common Issues

1. **Pods not starting**:
   ```bash
   kubectl describe pod <pod-name> -n medcontracthub
   kubectl logs <pod-name> -n medcontracthub
   ```

2. **Service connection issues**:
   ```bash
   kubectl get endpoints -n medcontracthub
   kubectl get svc -n medcontracthub
   ```

3. **Resource constraints**:
   ```bash
   kubectl top nodes
   kubectl top pods -n medcontracthub
   ```

4. **Ingress not working**:
   ```bash
   kubectl get ingress -n medcontracthub
   kubectl logs -n ingress-nginx deployment/nginx-ingress-controller
   ```

### Debug Commands
```bash
# Get all resources
kubectl get all -n medcontracthub

# Check events
kubectl get events -n medcontracthub --sort-by='.lastTimestamp'

# Execute commands in pod
kubectl exec -it <pod-name> -n medcontracthub -- /bin/bash

# Port forward for debugging
kubectl port-forward svc/<service-name> <local-port>:<service-port> -n medcontracthub
```

## Production Checklist

- [ ] TLS certificates configured
- [ ] Resource limits set appropriately
- [ ] PodDisruptionBudgets configured
- [ ] Backup procedures tested
- [ ] Monitoring alerts configured
- [ ] Sealed Secrets in use
- [ ] Network policies applied
- [ ] RBAC properly configured
- [ ] Ingress rate limiting enabled
- [ ] Database replicas running

## CI/CD Integration

Example GitOps workflow:
```yaml
# .github/workflows/deploy.yml
- name: Deploy to Kubernetes
  run: |
    kubectl apply -k k8s/overlays/${{ env.ENVIRONMENT }}/
    kubectl rollout status deployment -n medcontract-${{ env.ENVIRONMENT }}
```

## Security

- All secrets are managed via Sealed Secrets
- Network policies restrict pod-to-pod communication
- RBAC limits service account permissions
- TLS enabled for all external traffic
- Pod security policies enforced

## Support

For issues or questions:
1. Check pod logs: `kubectl logs -f <pod-name> -n medcontracthub`
2. Review events: `kubectl get events -n medcontracthub`
3. Check resource usage: `kubectl top pods -n medcontracthub`
4. Verify configurations: `kubectl describe <resource> <name> -n medcontracthub`