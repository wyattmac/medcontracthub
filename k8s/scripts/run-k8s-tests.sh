#!/bin/bash

# Comprehensive Kubernetes Testing Suite for MedContractHub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0

echo -e "${BLUE}MedContractHub Kubernetes Test Suite${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${YELLOW}Running: $test_name${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ $test_name passed${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
    echo ""
}

# 1. Namespace Tests
echo -e "${BLUE}1. Namespace Tests${NC}"
echo "=================="

run_test "Development namespace exists" \
    "kubectl get namespace medcontracthub &>/dev/null"

run_test "Staging namespace exists" \
    "kubectl get namespace medcontract-staging &>/dev/null"

run_test "Production namespace exists" \
    "kubectl get namespace medcontract-prod &>/dev/null"

# 2. Deployment Tests
echo -e "${BLUE}2. Deployment Tests${NC}"
echo "==================="

NAMESPACE=${NAMESPACE:-medcontracthub}

for deployment in medcontracthub-app ai-service ocr-service analytics-service realtime-service worker-service; do
    run_test "$deployment deployment exists" \
        "kubectl get deployment $deployment -n $NAMESPACE &>/dev/null"
    
    run_test "$deployment has ready replicas" \
        "[ $(kubectl get deployment $deployment -n $NAMESPACE -o jsonpath='{.status.readyReplicas}') -gt 0 ]"
done

# 3. Service Tests
echo -e "${BLUE}3. Service Tests${NC}"
echo "================"

for service in medcontracthub-app ai-service ocr-service analytics-service realtime-service; do
    run_test "$service service exists" \
        "kubectl get service $service -n $NAMESPACE &>/dev/null"
    
    run_test "$service has endpoints" \
        "[ $(kubectl get endpoints $service -n $NAMESPACE -o jsonpath='{.subsets[0].addresses}' | wc -c) -gt 2 ]"
done

# 4. Database Tests
echo -e "${BLUE}4. Database Tests${NC}"
echo "================="

run_test "PostgreSQL primary is running" \
    "kubectl exec postgres-primary-0 -n $NAMESPACE -- pg_isready -U postgres"

run_test "Redis cluster is healthy" \
    "kubectl exec redis-cluster-0 -n $NAMESPACE -- redis-cli ping | grep -q PONG"

# 5. Ingress Tests
echo -e "${BLUE}5. Ingress Tests${NC}"
echo "================"

run_test "Ingress exists" \
    "kubectl get ingress -n $NAMESPACE | grep -q medcontracthub"

run_test "Ingress has TLS configured" \
    "kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[0].spec.tls}' | grep -q secretName"

# 6. ConfigMap and Secret Tests
echo -e "${BLUE}6. Configuration Tests${NC}"
echo "======================"

run_test "Application ConfigMaps exist" \
    "kubectl get configmaps -n $NAMESPACE | grep -q medcontracthub"

run_test "Secrets are present" \
    "[ $(kubectl get secrets -n $NAMESPACE | grep -c medcontracthub) -gt 0 ]"

# 7. PVC Tests
echo -e "${BLUE}7. Storage Tests${NC}"
echo "================"

run_test "Backup PVC exists" \
    "kubectl get pvc backup-storage-pvc -n $NAMESPACE &>/dev/null"

run_test "Database PVCs are bound" \
    "! kubectl get pvc -n $NAMESPACE | grep -E 'postgres|redis|weaviate|clickhouse' | grep -q Pending"

# 8. API Contract Tests
echo -e "${BLUE}8. API Contract Tests${NC}"
echo "===================="

# Create test namespace
kubectl create namespace test --dry-run=client -o yaml | kubectl apply -f -

# Apply contract tests
kubectl apply -f tests/k8s/contract-test.yaml

# Wait for test completion
echo "Waiting for contract tests to complete..."
kubectl wait --for=condition=complete job/contract-tests -n test --timeout=300s

# Check test results
if kubectl logs job/contract-tests -n test | grep -q "passed"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e "${GREEN}✅ Contract tests passed${NC}"
else
    echo -e "${RED}❌ Contract tests failed${NC}"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 9. Performance Tests
echo -e "${BLUE}9. Performance Tests${NC}"
echo "===================="

if [ "$RUN_PERFORMANCE_TESTS" = "true" ]; then
    # Apply load test
    kubectl apply -f tests/k8s/load-test.yaml
    
    # Wait for load test
    echo "Running load tests (this may take several minutes)..."
    kubectl wait --for=condition=complete job/k6-load-test -n test --timeout=1200s
    
    # Check results
    if kubectl logs job/k6-load-test -n test | grep -q "✓"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✅ Load tests passed${NC}"
    else
        echo -e "${RED}❌ Load tests failed${NC}"
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "${YELLOW}Skipping performance tests (set RUN_PERFORMANCE_TESTS=true to enable)${NC}"
fi

# 10. Security Tests
echo -e "${BLUE}10. Security Tests${NC}"
echo "=================="

run_test "Network policies are enforced" \
    "[ $(kubectl get networkpolicies -n $NAMESPACE | wc -l) -gt 1 ]"

run_test "Pod Security Standards are configured" \
    "kubectl get namespace $NAMESPACE -o jsonpath='{.metadata.labels}' | grep -q pod-security"

run_test "Service accounts are configured" \
    "[ $(kubectl get serviceaccounts -n $NAMESPACE | grep -v default | wc -l) -gt 0 ]"

# 11. Monitoring Tests
echo -e "${BLUE}11. Monitoring Tests${NC}"
echo "==================="

run_test "ServiceMonitors are configured" \
    "kubectl get servicemonitors -n $NAMESPACE &>/dev/null"

run_test "Prometheus is scraping metrics" \
    "kubectl exec -n monitoring deployment/prometheus-server -- promtool query instant 'up{namespace=\"$NAMESPACE\"}' | grep -q value"

# 12. Backup Tests
echo -e "${BLUE}12. Backup Tests${NC}"
echo "================"

run_test "Backup CronJobs are configured" \
    "[ $(kubectl get cronjobs -n $NAMESPACE | grep -c backup) -ge 3 ]"

run_test "Backup storage is accessible" \
    "kubectl exec deployment/postgres-primary -n $NAMESPACE -- test -d /backups"

# Clean up test namespace
kubectl delete namespace test --ignore-not-found

# Summary
echo ""
echo -e "${BLUE}Test Summary${NC}"
echo "============"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"
echo ""

SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
if [ $SUCCESS_RATE -ge 90 ]; then
    echo -e "${GREEN}✅ Test suite PASSED (${SUCCESS_RATE}% success rate)${NC}"
    exit 0
else
    echo -e "${RED}❌ Test suite FAILED (${SUCCESS_RATE}% success rate)${NC}"
    exit 1
fi