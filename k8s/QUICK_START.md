# Kubernetes Quick Start Guide for MedContractHub

## 🚀 5-Minute Setup

### Prerequisites Check
```bash
# Verify Docker is running
docker ps

# Check if you have required tools
which kubectl helm kind || echo "Missing tools - run setup script"
```

### Step 1: Copy Environment Files
```bash
# Copy your existing .env.local to k8s secrets
cp .env.local k8s/base/app/secrets.env

# Or use the consolidated env
cp .env.consolidated k8s/base/app/secrets.env
```

### Step 2: Run Setup Script
```bash
# This installs dependencies and creates the cluster
./k8s/scripts/setup-local-k8s.sh
```

### Step 3: Build and Deploy
```bash
# Option A: Using Skaffold (Recommended for development)
skaffold dev --port-forward

# Option B: Manual deployment
# Build images
./k8s/scripts/dev-workflow.sh build app
./k8s/scripts/dev-workflow.sh build ocr
./k8s/scripts/dev-workflow.sh build integration

# Deploy to Kubernetes
kubectl apply -k k8s/base/
```

### Step 4: Verify Everything Works
```bash
# Check pods are running
kubectl get pods -n medcontracthub

# Test the application
curl http://localhost:31000/api/health

# Check opportunity count
curl http://localhost:31000/api/opportunities/count
```

## 🎯 Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Main App | http://localhost:31000 | MedContractHub application |
| OCR Service | http://localhost:31100 | OCR microservice API |
| Integration Adapter | http://localhost:31080 | Event bridge service |
| Kafka UI | http://localhost:30080 | Kafka management UI |
| Jaeger | http://localhost:30686 | Distributed tracing |

## 🛠️ Common Tasks

### View Logs
```bash
# All services
./k8s/scripts/dev-workflow.sh logs

# Specific service
./k8s/scripts/dev-workflow.sh logs app
```

### Access Monitoring
```bash
# Grafana dashboards
./k8s/scripts/dev-workflow.sh forward grafana
# Open http://localhost:3000 (admin/admin)

# Prometheus metrics
./k8s/scripts/dev-workflow.sh forward prometheus
# Open http://localhost:9090
```

### Debug Issues
```bash
# Get pod details
kubectl describe pod <pod-name> -n medcontracthub

# Open shell in pod
./k8s/scripts/dev-workflow.sh shell <pod-name>

# Check events
kubectl get events -n medcontracthub --sort-by='.lastTimestamp'
```

### Clean Up
```bash
# Stop Skaffold
# Press Ctrl+C in the skaffold terminal

# Remove all resources
kubectl delete -k k8s/base/

# Delete cluster (if needed)
kind delete cluster --name medcontracthub-dev
```

## 🔄 Development Workflow

### Hot Reload with Skaffold
```bash
# Start development mode
skaffold dev --port-forward

# Make changes to code - Skaffold auto-rebuilds and deploys
# Press Ctrl+C to stop
```

### Manual Updates
```bash
# After code changes
./k8s/scripts/dev-workflow.sh build app
./k8s/scripts/dev-workflow.sh deploy app
```

### Local Development with Telepresence
```bash
# Intercept cluster traffic to local service
./k8s/scripts/dev-workflow.sh sync
# Select service to intercept
# Run your service locally
```

## ⚠️ Troubleshooting

### Pods Stuck in Pending
```bash
# Check node resources
kubectl describe nodes
kubectl top nodes

# Check PVC status
kubectl get pvc -A
```

### Image Pull Errors
```bash
# Verify registry is running
docker ps | grep registry

# Rebuild and push image
./k8s/scripts/dev-workflow.sh build app
```

### Connection Refused
```bash
# Check service endpoints
kubectl get endpoints -n medcontracthub

# Verify port forwarding
kubectl get svc -n medcontracthub
```

## 📚 Next Steps

1. **Explore Monitoring**: Access Grafana for pre-built dashboards
2. **Test OCR Service**: Upload documents through the UI
3. **Check Event Flow**: Watch Kafka UI for real-time events
4. **Scale Services**: Try scaling deployments up/down
5. **Customize Config**: Edit ConfigMaps and Secrets

For detailed documentation, see [k8s/README.md](./README.md)