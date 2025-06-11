#!/bin/bash
# Security Configuration Test Script for MedContractHub

set -e

echo "🔐 MedContractHub Security Configuration Test Suite"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test results
PASSED=0
FAILED=0

# Test function
run_test() {
    local test_name=$1
    local test_cmd=$2
    local expected=$3
    
    echo -n "Testing: $test_name... "
    
    if eval "$test_cmd" &>/dev/null; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Expected: $expected"
        ((FAILED++))
    fi
}

echo "1. Pod Security Standards Tests"
echo "==============================="

run_test "PSS labels on namespaces" \
    "kubectl get ns medcontract-prod -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}' | grep -q restricted" \
    "Namespace should have PSS restricted label"

run_test "No privileged containers" \
    "! kubectl get pods -A -o json | jq -r '.items[].spec.containers[] | select(.securityContext.privileged == true) | .name' | grep -q ." \
    "No containers should run privileged"

echo ""
echo "2. Network Policy Tests"
echo "======================="

run_test "Default deny-all policy exists" \
    "kubectl get networkpolicy -n medcontract-prod default-deny-all" \
    "Default deny network policy should exist"

run_test "App-specific policies exist" \
    "kubectl get networkpolicy -n medcontract-prod | grep -q 'app-to-database'" \
    "Application network policies should exist"

echo ""
echo "3. RBAC Tests"
echo "============="

run_test "No service accounts with cluster-admin" \
    "! kubectl get clusterrolebindings -o json | jq -r '.items[] | select(.roleRef.name == \"cluster-admin\") | .subjects[]? | select(.kind == \"ServiceAccount\")' | grep -q ." \
    "No service accounts should have cluster-admin"

run_test "Least privilege roles exist" \
    "kubectl get clusterrole medcontracthub-developer" \
    "Developer role should exist"

echo ""
echo "4. OPA Gatekeeper Tests"
echo "======================="

run_test "Gatekeeper is running" \
    "kubectl get pods -n gatekeeper-system -l app=gatekeeper | grep -q Running" \
    "Gatekeeper pods should be running"

run_test "Constraint templates applied" \
    "kubectl get constrainttemplates | grep -q k8srequiredregistries" \
    "Registry constraint template should exist"

run_test "Constraints are enforced" \
    "kubectl get k8srequiredregistries must-use-approved-registries" \
    "Registry constraints should be enforced"

echo ""
echo "5. Falco Runtime Security Tests"
echo "==============================="

run_test "Falco is running" \
    "kubectl get pods -n falco -l app.kubernetes.io/name=falco | grep -q Running" \
    "Falco pods should be running"

run_test "Custom rules loaded" \
    "kubectl get configmap -n falco falco-custom-rules" \
    "Custom Falco rules should be loaded"

echo ""
echo "6. Secret Management Tests"
echo "========================="

run_test "Secret rotation cronjobs exist" \
    "kubectl get cronjob -n medcontracthub database-password-rotation" \
    "Database password rotation job should exist"

run_test "API key rotation configured" \
    "kubectl get cronjob -n medcontracthub api-key-rotation" \
    "API key rotation job should exist"

echo ""
echo "7. Security Context Tests"
echo "========================"

run_test "Containers run as non-root" \
    "! kubectl get pods -A -o json | jq -r '.items[].spec.containers[] | select(.securityContext.runAsUser == 0) | .name' | grep -q ." \
    "No containers should run as root"

run_test "Read-only root filesystem" \
    "kubectl get pods -n medcontracthub -o json | jq -r '.items[].spec.containers[] | select(.securityContext.readOnlyRootFilesystem == true) | .name' | grep -q ." \
    "Containers should have read-only root filesystem"

echo ""
echo "8. Resource Limits Tests"
echo "======================="

run_test "All pods have resource limits" \
    "! kubectl get pods -A -o json | jq -r '.items[] | select(.spec.containers[].resources.limits == null) | .metadata.name' | grep -q ." \
    "All pods should have resource limits"

echo ""
echo "9. Image Security Tests"
echo "======================"

run_test "No latest tags in production" \
    "! kubectl get pods -n medcontract-prod -o json | jq -r '.items[].spec.containers[].image' | grep -q ':latest'" \
    "No :latest tags in production"

run_test "Images from approved registries" \
    "kubectl get pods -n medcontract-prod -o json | jq -r '.items[].spec.containers[].image' | grep -E '^(registry.medcontracthub.com|ghcr.io/medcontracthub)/'" \
    "All images from approved registries"

echo ""
echo "10. Compliance Tests"
echo "==================="

run_test "HIPAA compliance policy active" \
    "kubectl get k8shipaacompliance hipaa-compliance-required" \
    "HIPAA compliance policy should be active"

run_test "Audit logging enabled" \
    "kubectl get deployments -n medcontract-prod -o json | jq -r '.items[].metadata.annotations[\"audit.medcontracthub.com/enabled\"]' | grep -q true" \
    "Audit logging should be enabled"

echo ""
echo "========================================"
echo "Security Test Summary"
echo "========================================"
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "Tests Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All security tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some security tests failed. Please review and fix.${NC}"
    exit 1
fi