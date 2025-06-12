#!/bin/bash

# Test script for verifying monitoring setup
# This script checks that all monitoring endpoints are accessible

set -e

echo "🔍 MedContractHub Monitoring Verification"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check endpoint
check_endpoint() {
    local service=$1
    local endpoint=$2
    local namespace=${3:-medcontracthub}
    
    echo -n "Checking $service... "
    
    if kubectl exec -n $namespace deployment/curl-test -- curl -s -o /dev/null -w "%{http_code}" $endpoint | grep -q "200"; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        return 1
    fi
}

# Deploy a curl pod for testing
echo "Deploying test pod..."
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: curl-test
  namespace: medcontracthub
spec:
  containers:
  - name: curl
    image: curlimages/curl:8.5.0
    command: ["/bin/sh", "-c", "sleep 3600"]
EOF

# Wait for pod to be ready
kubectl wait --for=condition=Ready pod/curl-test -n medcontracthub --timeout=60s

echo ""
echo "Testing Microservice Metrics Endpoints:"
echo "--------------------------------------"

# Test microservice metrics
check_endpoint "OCR Service" "http://ocr-service:8100/metrics"
check_endpoint "AI Service" "http://ai-service:8200/metrics"
check_endpoint "Analytics Service" "http://analytics-service:8300/metrics"
check_endpoint "Real-time Service" "http://realtime-service:8400/metrics"
check_endpoint "Worker Service" "http://worker-service:8500/metrics"

echo ""
echo "Testing Infrastructure Metrics:"
echo "------------------------------"

# Test exporters
check_endpoint "Kafka Exporter" "http://kafka-exporter:9308/metrics"
check_endpoint "Redis Exporter" "http://redis-exporter:9121/metrics"
check_endpoint "Postgres Exporter" "http://postgres-exporter:9187/metrics"

echo ""
echo "Testing Monitoring Stack:"
echo "------------------------"

# Test monitoring services
check_endpoint "Prometheus" "http://prometheus-server:9090/-/healthy" "monitoring"
check_endpoint "Grafana" "http://grafana:3000/api/health" "monitoring"
check_endpoint "Jaeger Query" "http://jaeger-query:16686/" "monitoring"

echo ""
echo "Checking ServiceMonitors:"
echo "------------------------"

# Check ServiceMonitors
for sm in analytics-service-monitor realtime-service-monitor worker-service-monitor kafka-exporter-monitor redis-exporter-monitor; do
    if kubectl get servicemonitor $sm -n medcontracthub &>/dev/null; then
        echo -e "$sm: ${GREEN}✓ Exists${NC}"
    else
        echo -e "$sm: ${RED}✗ Missing${NC}"
    fi
done

echo ""
echo "Checking Prometheus Targets:"
echo "---------------------------"

# Port forward to Prometheus
kubectl port-forward -n monitoring svc/prometheus-server 9090:9090 &
PF_PID=$!
sleep 2

# Check targets
echo "Active targets in Prometheus:"
curl -s http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.job): \(.health)"' | sort | uniq

# Kill port forward
kill $PF_PID 2>/dev/null || true

echo ""
echo "Checking Grafana Dashboards:"
echo "---------------------------"

# Port forward to Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000 &
PF_PID=$!
sleep 2

# Check dashboards (requires Grafana API key)
echo "Available dashboards:"
curl -s http://localhost:3000/api/search?type=dash-db | jq -r '.[].title' || echo "Unable to fetch dashboards (API key required)"

# Kill port forward
kill $PF_PID 2>/dev/null || true

echo ""
echo "Sample Metrics:"
echo "--------------"

# Get some sample metrics
echo "Sample metrics from OCR service:"
kubectl exec -n medcontracthub deployment/curl-test -- curl -s http://ocr-service:8100/metrics | grep -E "^ocr_|^http_" | head -5

# Cleanup
echo ""
echo "Cleaning up test pod..."
kubectl delete pod curl-test -n medcontracthub --grace-period=0 --force

echo ""
echo "✅ Monitoring verification complete!"
echo ""
echo "Next steps:"
echo "1. Access Grafana: kubectl port-forward -n monitoring svc/grafana 3000:3000"
echo "2. Access Prometheus: kubectl port-forward -n monitoring svc/prometheus-server 9090:9090"
echo "3. Access Jaeger: kubectl port-forward -n monitoring svc/jaeger-query 16686:16686"