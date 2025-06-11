#!/bin/bash
# Setup script for MedContractHub security components

set -e

echo "🔒 Setting up MedContractHub Security Components..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}kubectl not found. Please install kubectl first.${NC}"
        exit 1
    fi
    
    if ! command -v helm &> /dev/null; then
        echo -e "${RED}Helm not found. Please install Helm first.${NC}"
        exit 1
    fi
}

# Install OPA Gatekeeper
install_gatekeeper() {
    echo -e "${GREEN}Installing OPA Gatekeeper...${NC}"
    
    # Add Gatekeeper repo
    helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
    helm repo update
    
    # Install Gatekeeper
    helm install gatekeeper gatekeeper/gatekeeper \
        --namespace gatekeeper-system \
        --create-namespace \
        --set replicas=3 \
        --set auditInterval=60 \
        --set constraintViolationsLimit=20 \
        --set auditFromCache=true \
        --set disableValidatingWebhook=false \
        --set validatingWebhookTimeoutSeconds=5 \
        --set validatingWebhookFailurePolicy=Fail
    
    # Wait for Gatekeeper to be ready
    echo "Waiting for Gatekeeper to be ready..."
    kubectl wait --for=condition=Ready pod -l app=gatekeeper -n gatekeeper-system --timeout=300s
    
    # Apply constraint templates
    echo "Applying constraint templates..."
    kubectl apply -f k8s/base/security/opa-gatekeeper/constraint-templates.yaml
    sleep 10  # Give Gatekeeper time to process templates
    
    # Apply constraints
    echo "Applying constraints..."
    kubectl apply -f k8s/base/security/opa-gatekeeper/constraints.yaml
}

# Install Falco
install_falco() {
    echo -e "${GREEN}Installing Falco...${NC}"
    
    # Add Falco repo
    helm repo add falcosecurity https://falcosecurity.github.io/charts
    helm repo update
    
    # Install Falco
    helm install falco falcosecurity/falco \
        --namespace falco \
        --create-namespace \
        --set driver.kind=ebpf \
        --set falcosidekick.enabled=true \
        --set falcosidekick.webui.enabled=true \
        --set collectors.kubernetes.enabled=true \
        --set falco.grpc.enabled=true \
        --set falco.grpc_output.enabled=true
    
    # Wait for Falco to be ready
    echo "Waiting for Falco to be ready..."
    kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=falco -n falco --timeout=300s
    
    # Apply custom rules
    echo "Applying custom Falco rules..."
    kubectl apply -f k8s/base/security/falco/custom-rules.yaml
}

# Apply Pod Security Standards
apply_pss() {
    echo -e "${GREEN}Applying Pod Security Standards...${NC}"
    
    # Label namespaces with PSS
    kubectl label namespace medcontract-dev \
        pod-security.kubernetes.io/enforce=restricted \
        pod-security.kubernetes.io/audit=restricted \
        pod-security.kubernetes.io/warn=restricted \
        --overwrite
    
    kubectl label namespace medcontract-staging \
        pod-security.kubernetes.io/enforce=restricted \
        pod-security.kubernetes.io/audit=restricted \
        pod-security.kubernetes.io/warn=restricted \
        --overwrite
    
    kubectl label namespace medcontract-prod \
        pod-security.kubernetes.io/enforce=restricted \
        pod-security.kubernetes.io/audit=restricted \
        pod-security.kubernetes.io/warn=restricted \
        --overwrite
    
    # Apply PSS configuration
    kubectl apply -f k8s/base/security/pod-security-standards/
}

# Apply RBAC policies
apply_rbac() {
    echo -e "${GREEN}Applying RBAC policies...${NC}"
    
    kubectl apply -f k8s/base/security/rbac/least-privilege.yaml
    kubectl apply -f k8s/base/security/audit/audit-policy.yaml
}

# Set up secret rotation
setup_secret_rotation() {
    echo -e "${GREEN}Setting up secret rotation...${NC}"
    
    kubectl apply -f k8s/base/security/secret-rotation/rotation-cronjobs.yaml
}

# Set up compliance automation
setup_compliance() {
    echo -e "${GREEN}Setting up compliance automation...${NC}"
    
    kubectl apply -f k8s/base/security/compliance/hipaa-compliance.yaml
    kubectl apply -f k8s/base/security/compliance/fedramp-compliance.yaml
}

# Install Trivy Operator for vulnerability scanning
install_trivy_operator() {
    echo -e "${GREEN}Installing Trivy Operator...${NC}"
    
    helm repo add aqua https://aquasecurity.github.io/helm-charts/
    helm repo update
    
    helm install trivy-operator aqua/trivy-operator \
        --namespace trivy-system \
        --create-namespace \
        --set="trivy.ignoreUnfixed=true" \
        --set="operator.scanJobTimeout=10m" \
        --set="operator.scanJobsConcurrentLimit=10"
}

# Main installation flow
main() {
    echo -e "${GREEN}=== MedContractHub Security Setup ===${NC}"
    echo "This script will install and configure:"
    echo "- OPA Gatekeeper for policy enforcement"
    echo "- Falco for runtime security"
    echo "- Pod Security Standards"
    echo "- RBAC policies"
    echo "- Secret rotation automation"
    echo "- Compliance automation (HIPAA/FedRAMP)"
    echo "- Trivy Operator for vulnerability scanning"
    echo ""
    
    check_prerequisites
    
    # Install components
    install_gatekeeper
    install_falco
    apply_pss
    apply_rbac
    setup_secret_rotation
    setup_compliance
    install_trivy_operator
    
    echo -e "${GREEN}✅ Security setup completed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Check Gatekeeper policies: kubectl get constraints"
    echo "2. View Falco alerts: kubectl logs -n falco -l app.kubernetes.io/name=falco"
    echo "3. Access Falco UI: kubectl port-forward -n falco svc/falco-falcosidekick-ui 2802:2802"
    echo "4. Check vulnerability reports: kubectl get vulnerabilityreports -A"
    echo "5. Review compliance scan results: kubectl get configmaps -l compliance=hipaa"
}

# Run main function
main