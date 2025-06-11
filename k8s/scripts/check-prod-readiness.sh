#!/bin/bash

# Production Readiness Check Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Score tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0

echo -e "${BLUE}MedContractHub Production Readiness Check${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Function to check a requirement
check_requirement() {
    local description="$1"
    local command="$2"
    local required="${3:-true}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "Checking $description... "
    
    if eval "$command" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}✗ (REQUIRED)${NC}"
        else
            echo -e "${YELLOW}✗ (RECOMMENDED)${NC}"
        fi
        return 1
    fi
}

# Function to check with output
check_with_output() {
    local description="$1"
    local command="$2"
    local expected="$3"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "Checking $description... "
    
    local output=$(eval "$command" 2>/dev/null || echo "")
    if [[ "$output" == *"$expected"* ]]; then
        echo -e "${GREEN}✓${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

echo -e "${BLUE}1. Infrastructure Requirements${NC}"
echo "================================"

check_requirement "Kubernetes cluster access" "kubectl cluster-info"
check_requirement "Minimum 3 nodes" "[ $(kubectl get nodes --no-headers | wc -l) -ge 3 ]"
check_requirement "NGINX Ingress controller" "kubectl get deployment -n ingress-nginx ingress-nginx-controller"
check_requirement "Cert-manager installed" "kubectl get deployment -n cert-manager cert-manager"
check_requirement "Monitoring namespace exists" "kubectl get namespace monitoring"
check_requirement "Istio installed" "kubectl get deployment -n istio-system istiod" false

echo ""
echo -e "${BLUE}2. Container Registry${NC}"
echo "====================="

check_requirement "Harbor namespace exists" "kubectl get namespace harbor" false
check_requirement "Alternative registry configured" "docker info | grep -E 'Registry|Hub'" 
check_requirement "Image scanning available" "kubectl get crd vulnerabilityreports.aquasecurity.github.io" false

echo ""
echo -e "${BLUE}3. Secrets Management${NC}"
echo "====================="

check_requirement "External Secrets Operator" "kubectl get deployment -n external-secrets external-secrets" false
check_requirement "Sealed Secrets controller" "kubectl get deployment -n kube-system sealed-secrets-controller"
check_requirement "Secret stores configured" "kubectl get secretstores -A --no-headers | grep -v '^$'" false

echo ""
echo -e "${BLUE}4. Networking & Security${NC}"
echo "========================"

check_requirement "Production ClusterIssuer" "kubectl get clusterissuer letsencrypt-prod" false
check_requirement "Network policies defined" "kubectl get networkpolicies -n medcontracthub --no-headers | grep -v '^$'"
check_requirement "Pod Security Standards" "kubectl get namespace medcontracthub -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}'" false
check_requirement "RBAC configured" "kubectl get rolebindings,clusterrolebindings -A | grep medcontract"

echo ""
echo -e "${BLUE}5. Data Services${NC}"
echo "================"

check_requirement "PostgreSQL deployed" "kubectl get statefulset -n medcontracthub postgres-primary"
check_requirement "Redis cluster deployed" "kubectl get statefulset -n medcontracthub redis-cluster"
check_requirement "Backup PVCs exist" "kubectl get pvc -n medcontracthub backup-storage-pvc"
check_requirement "Backup CronJobs configured" "kubectl get cronjobs -n medcontracthub | grep backup"

echo ""
echo -e "${BLUE}6. Monitoring & Observability${NC}"
echo "============================="

check_requirement "Prometheus deployed" "kubectl get deployment -n monitoring prometheus-server" false
check_requirement "Grafana deployed" "kubectl get deployment -n monitoring grafana" false
check_requirement "Jaeger deployed" "kubectl get deployment -n monitoring jaeger"
check_requirement "ServiceMonitors configured" "kubectl get servicemonitors -A | grep medcontract" false

echo ""
echo -e "${BLUE}7. Application Services${NC}"
echo "======================="

check_requirement "All deployments ready" "kubectl get deployments -n medcontracthub -o json | jq -e '.items | map(select(.status.replicas == .status.readyReplicas)) | length == .items | length'"
check_requirement "All pods running" "! kubectl get pods -n medcontracthub | grep -E 'Error|CrashLoop|Pending'"
check_requirement "HPA configured" "kubectl get hpa -n medcontracthub --no-headers | grep -v '^$'"
check_requirement "PDB configured" "kubectl get pdb -n medcontracthub --no-headers | grep -v '^$'"

echo ""
echo -e "${BLUE}8. CI/CD Integration${NC}"
echo "===================="

check_requirement "GitHub Actions secrets" "[ -f .github/workflows/deploy.yml ]" false
check_requirement "ArgoCD installed" "kubectl get deployment -n argocd argocd-server" false
check_requirement "Image pull secrets" "kubectl get secrets -n medcontracthub | grep docker-registry"

echo ""
echo -e "${BLUE}Production Readiness Score${NC}"
echo "=========================="
SCORE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
echo -e "Score: ${PASSED_CHECKS}/${TOTAL_CHECKS} (${SCORE}%)"
echo ""

if [ $SCORE -ge 90 ]; then
    echo -e "${GREEN}✅ System is PRODUCTION READY!${NC}"
elif [ $SCORE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  System is MOSTLY READY - address remaining issues${NC}"
else
    echo -e "${RED}❌ System is NOT READY for production${NC}"
fi

echo ""
echo -e "${BLUE}Recommendations:${NC}"
if ! kubectl get namespace harbor &> /dev/null; then
    echo "- Run 'make k8s-setup-harbor' to set up container registry"
fi
if ! kubectl get deployment -n external-secrets external-secrets &> /dev/null; then
    echo "- Run 'make k8s-setup-eso' to set up External Secrets Operator"
fi
if ! kubectl get clusterissuer letsencrypt-prod &> /dev/null; then
    echo "- Run 'make k8s-setup-prod-tls' to configure production TLS"
fi
if ! kubectl get deployment -n monitoring prometheus-server &> /dev/null; then
    echo "- Deploy Prometheus and Grafana for monitoring"
fi
if ! kubectl get deployment -n argocd argocd-server &> /dev/null; then
    echo "- Consider setting up ArgoCD for GitOps"
fi