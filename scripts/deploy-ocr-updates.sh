#!/bin/bash

# Deploy OCR Service Updates with Multi-Level Caching
# This script deploys the new OCR service with enhanced caching capabilities

set -e

echo "🚀 Deploying OCR Service Updates with Multi-Level Caching"
echo "========================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command_exists kubectl; then
    echo -e "${RED}❌ kubectl not found. Please install kubectl.${NC}"
    exit 1
fi

if ! command_exists docker; then
    echo -e "${RED}❌ docker not found. Please install docker.${NC}"
    exit 1
fi

# Check cluster connection
echo "🔍 Checking Kubernetes cluster connection..."
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites satisfied${NC}"

# Step 1: Build and push OCR service image
echo -e "\n${YELLOW}Step 1: Building OCR Service Docker Image${NC}"
cd services/ocr-service

echo "📦 Building OCR service v2.0.0..."
docker build -t medcontracthub/ocr-service:2.0.0 .

echo "🏷️  Tagging for local registry..."
docker tag medcontracthub/ocr-service:2.0.0 localhost:5001/ocr-service:2.0.0

echo "📤 Pushing to local registry..."
docker push localhost:5001/ocr-service:2.0.0

cd ../..

# Step 2: Deploy Redis cache instances
echo -e "\n${YELLOW}Step 2: Deploying Redis Cache Instances${NC}"

echo "🗄️  Deploying Redis L1 cache (hot data)..."
kubectl apply -f k8s/base/redis/redis-l1-cache.yaml

echo "🗄️  Deploying Redis L2 cache (warm data)..."
kubectl apply -f k8s/base/redis/redis-l2-cache.yaml

echo "⏳ Waiting for Redis instances to be ready..."
kubectl wait --for=condition=ready pod -l app=redis-l1-cache -n medcontracthub --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis-l2-cache -n medcontracthub --timeout=120s

# Step 3: Update OCR service configuration
echo -e "\n${YELLOW}Step 3: Updating OCR Service Configuration${NC}"

echo "📝 Applying updated ConfigMap..."
kubectl apply -f k8s/base/ocr-service/configmap.yaml

echo "🚀 Deploying OCR service v2.0.0..."
kubectl apply -f k8s/base/ocr-service/deployment.yaml

echo "⏳ Waiting for OCR service rollout..."
kubectl rollout status deployment/ocr-service -n medcontracthub --timeout=300s

# Step 4: Run database migrations
echo -e "\n${YELLOW}Step 4: Running Database Migrations${NC}"

echo "💾 Backing up database..."
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
kubectl exec -it postgres-primary-0 -n medcontracthub -- pg_dump -U postgres medcontracthub > $BACKUP_FILE
echo -e "${GREEN}✓ Database backed up to $BACKUP_FILE${NC}"

echo "🔄 Running contract family migration..."
npm run db:migrate

# Step 5: Update monitoring
echo -e "\n${YELLOW}Step 5: Updating Monitoring Configuration${NC}"

echo "📊 Applying Prometheus configuration..."
kubectl apply -f k8s/base/monitoring/prometheus-microservices-config.yaml

echo "📈 Updating Grafana dashboards..."
kubectl apply -k k8s/base/monitoring/

# Step 6: Verify deployment
echo -e "\n${YELLOW}Step 6: Verifying Deployment${NC}"

echo "🔍 Checking pod status..."
kubectl get pods -l app=ocr-service -n medcontracthub

echo "📋 Checking service health..."
OCR_POD=$(kubectl get pod -l app=ocr-service -n medcontracthub -o jsonpath="{.items[0].metadata.name}")
kubectl exec $OCR_POD -n medcontracthub -- curl -s http://localhost:8100/health | jq .

# Step 7: Test cache metrics
echo -e "\n${YELLOW}Step 7: Testing Cache Metrics${NC}"

echo "📊 Setting up port forward..."
kubectl port-forward svc/ocr-service 8100:8100 -n medcontracthub &
PF_PID=$!
sleep 5

echo "🔍 Checking cache metrics endpoint..."
curl -s http://localhost:8100/cache/metrics | jq .

kill $PF_PID 2>/dev/null || true

# Step 8: Display access information
echo -e "\n${GREEN}✅ Deployment Complete!${NC}"
echo "========================"
echo ""
echo "📊 Access Grafana Dashboard:"
echo "   kubectl port-forward svc/grafana 3000:3000 -n monitoring"
echo "   URL: http://localhost:3000"
echo "   Dashboard: Multi-Level Cache Performance"
echo ""
echo "🔍 Monitor OCR Service Logs:"
echo "   kubectl logs -f -l app=ocr-service -n medcontracthub"
echo ""
echo "📈 Check Cache Performance:"
echo "   kubectl port-forward svc/ocr-service 8100:8100 -n medcontracthub"
echo "   curl http://localhost:8100/cache/metrics | jq ."
echo ""
echo "🚨 Rollback if needed:"
echo "   kubectl set image deployment/ocr-service ocr-service=medcontracthub/ocr-service:1.0.0 -n medcontracthub"
echo "   psql -U postgres medcontracthub < $BACKUP_FILE"
echo ""

# Check for any errors
ERROR_PODS=$(kubectl get pods -n medcontracthub | grep -E "Error|CrashLoopBackOff" || true)
if [ -n "$ERROR_PODS" ]; then
    echo -e "${RED}⚠️  Warning: Some pods are in error state:${NC}"
    echo "$ERROR_PODS"
    echo ""
    echo "Run 'kubectl describe pod <pod-name> -n medcontracthub' for details"
fi