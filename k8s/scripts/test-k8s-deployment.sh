#!/bin/bash

# Kubernetes Deployment Testing Script
# Tests all components of MedContractHub Kubernetes deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE="${NAMESPACE:-medcontracthub}"
TIMEOUT=300

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}MedContractHub K8s Testing${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Function to check if a resource exists
check_resource() {
    local resource_type=$1
    local resource_name=$2
    local namespace=${3:-$NAMESPACE}
    
    if kubectl get $resource_type $resource_name -n $namespace &> /dev/null; then
        echo -e "${GREEN}✓${NC} $resource_type/$resource_name exists"
        return 0
    else
        echo -e "${RED}✗${NC} $resource_type/$resource_name not found"
        return 1
    fi
}

# Function to check if pod is ready
check_pod_ready() {
    local deployment=$1
    local namespace=${2:-$NAMESPACE}
    
    echo -n "Checking $deployment readiness..."
    if kubectl wait --for=condition=available --timeout=${TIMEOUT}s deployment/$deployment -n $namespace &> /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        return 0
    else
        echo -e " ${RED}✗${NC}"
        return 1
    fi
}

# Function to test endpoint
test_endpoint() {
    local service=$1
    local port=$2
    local path=${3:-"/health"}
    local namespace=${4:-$NAMESPACE}
    
    echo -n "Testing $service:$port$path..."
    
    # Get service ClusterIP
    local service_ip=$(kubectl get svc $service -n $namespace -o jsonpath='{.spec.clusterIP}' 2>/dev/null)
    
    if [ -z "$service_ip" ]; then
        echo -e " ${RED}✗${NC} (service not found)"
        return 1
    fi
    
    # Test from within cluster
    local response=$(kubectl run curl-test-$RANDOM --rm -i --restart=Never --image=curlimages/curl -- \
        curl -s -o /dev/null -w "%{http_code}" http://$service_ip:$port$path 2>/dev/null || echo "000")
    
    if [[ "$response" =~ ^[23][0-9][0-9]$ ]]; then
        echo -e " ${GREEN}✓${NC} (HTTP $response)"
        return 0
    else
        echo -e " ${RED}✗${NC} (HTTP $response)"
        return 1
    fi
}

# Test 1: Check Namespaces
echo -e "${YELLOW}1. Checking Namespaces...${NC}"
check_resource namespace medcontracthub
check_resource namespace medcontract-staging
check_resource namespace medcontract-prod
check_resource namespace monitoring
echo ""

# Test 2: Check Core Services
echo -e "${YELLOW}2. Checking Core Services...${NC}"
check_resource deployment medcontracthub-app
check_resource deployment ocr-service
check_resource deployment integration-adapter
check_resource deployment ai-service
check_resource deployment analytics-service
check_resource deployment worker-service
check_resource statefulset realtime-service
check_resource statefulset postgres-primary
check_resource statefulset weaviate
check_resource statefulset clickhouse
echo ""

# Test 3: Check Service Readiness
echo -e "${YELLOW}3. Checking Service Readiness...${NC}"
check_pod_ready medcontracthub-app
check_pod_ready ocr-service
check_pod_ready ai-service
check_pod_ready analytics-service
check_pod_ready worker-service
echo ""

# Test 4: Check Services
echo -e "${YELLOW}4. Checking Kubernetes Services...${NC}"
check_resource service medcontracthub-app
check_resource service ocr-service
check_resource service ai-service
check_resource service analytics-service
check_resource service realtime-service
check_resource service kong-proxy
echo ""

# Test 5: Check Ingress
echo -e "${YELLOW}5. Checking Ingress Configuration...${NC}"
check_resource ingress medcontracthub-ingress
echo ""

# Test 6: Check ConfigMaps and Secrets
echo -e "${YELLOW}6. Checking Configuration...${NC}"
check_resource configmap medcontracthub-config
check_resource secret medcontracthub-secrets
check_resource configmap ai-service-config
check_resource secret ai-service-secrets
echo ""

# Test 7: Test Service Endpoints
echo -e "${YELLOW}7. Testing Service Endpoints...${NC}"
test_endpoint medcontracthub-app 3000 /api/health
test_endpoint ocr-service 8100 /health
test_endpoint ai-service 8200 /health
test_endpoint analytics-service 8300 /health
echo ""

# Test 8: Check Resource Usage
echo -e "${YELLOW}8. Checking Resource Usage...${NC}"
if kubectl top nodes &> /dev/null; then
    echo "Node resources:"
    kubectl top nodes | head -5
    echo ""
    echo "Pod resources (top 10):"
    kubectl top pods -n $NAMESPACE --sort-by=cpu | head -10
else
    echo -e "${YELLOW}Warning: Metrics server not installed${NC}"
fi
echo ""

# Test 9: Check Recent Events
echo -e "${YELLOW}9. Recent Events (last 10)...${NC}"
kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -10
echo ""

# Test 10: Database Connectivity
echo -e "${YELLOW}10. Testing Database Connectivity...${NC}"
echo -n "PostgreSQL primary..."
if kubectl exec -n $NAMESPACE postgres-primary-0 -- pg_isready &> /dev/null; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${RED}✗${NC}"
fi

echo -n "Redis cluster..."
if kubectl exec -n $NAMESPACE redis-cluster-0 -- redis-cli ping &> /dev/null; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${RED}✗${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}================================${NC}"

# Count successes and failures
TOTAL_TESTS=20
FAILED_TESTS=$(grep -c "✗" $0 || true)
PASSED_TESTS=$((TOTAL_TESTS - FAILED_TESTS))

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    echo -e "MedContractHub is ready for use."
else
    echo -e "${YELLOW}Tests completed with issues:${NC}"
    echo -e "  Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "  Failed: ${RED}$FAILED_TESTS${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting tips:${NC}"
    echo "  1. Check pod logs: kubectl logs -n $NAMESPACE <pod-name>"
    echo "  2. Describe failing pods: kubectl describe pod -n $NAMESPACE <pod-name>"
    echo "  3. Check events: kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'"
fi

echo ""
echo -e "${BLUE}Quick access commands:${NC}"
echo "  Main app:     make k8s-forward SERVICE=medcontracthub-app PORT=3000"
echo "  AI Service:   make k8s-forward SERVICE=ai-service PORT=8200"
echo "  Grafana:      make k8s-forward SERVICE=grafana PORT=3000 NAMESPACE=monitoring"
echo "  View logs:    make k8s-logs SERVICE=<service-name>"

exit $FAILED_TESTS