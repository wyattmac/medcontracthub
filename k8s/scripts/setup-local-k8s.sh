#!/bin/bash

# Local Kubernetes Development Environment Setup Script
# Supports both Kind and Minikube for WSL2 compatibility

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
K8S_PROVIDER="${K8S_PROVIDER:-kind}" # Options: kind, minikube
CLUSTER_NAME="medcontracthub-dev"
NAMESPACE="medcontracthub"
HELM_VERSION="v3.13.0"
ISTIO_VERSION="1.20.0"
KONG_VERSION="2.35.0"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}MedContractHub K8s Development Setup${NC}"
echo -e "${BLUE}======================================${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install dependencies
install_dependencies() {
    echo -e "${YELLOW}Installing dependencies...${NC}"
    
    # Install kubectl
    if ! command_exists kubectl; then
        echo "Installing kubectl..."
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        chmod +x kubectl
        sudo mv kubectl /usr/local/bin/
    fi
    
    # Install Helm
    if ! command_exists helm; then
        echo "Installing Helm..."
        curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
    fi
    
    # Install Kind or Minikube based on preference
    if [ "$K8S_PROVIDER" = "kind" ]; then
        if ! command_exists kind; then
            echo "Installing Kind..."
            curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
            chmod +x ./kind
            sudo mv ./kind /usr/local/bin/kind
        fi
    else
        if ! command_exists minikube; then
            echo "Installing Minikube..."
            curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
            sudo install minikube-linux-amd64 /usr/local/bin/minikube
            rm minikube-linux-amd64
        fi
    fi
    
    # Install kustomize
    if ! command_exists kustomize; then
        echo "Installing Kustomize..."
        curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
        sudo mv kustomize /usr/local/bin/
    fi
    
    # Install skaffold for development
    if ! command_exists skaffold; then
        echo "Installing Skaffold..."
        curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-linux-amd64
        chmod +x skaffold
        sudo mv skaffold /usr/local/bin/
    fi
}

# Function to create Kind cluster
create_kind_cluster() {
    echo -e "${YELLOW}Creating Kind cluster...${NC}"
    
    # Check if cluster already exists
    if kind get clusters | grep -q "$CLUSTER_NAME"; then
        echo "Cluster already exists. Deleting..."
        kind delete cluster --name="$CLUSTER_NAME"
    fi
    
    # Create Kind config
    cat > /tmp/kind-config.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: ${CLUSTER_NAME}
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
  - containerPort: 30000
    hostPort: 30000
    protocol: TCP
  - containerPort: 30001
    hostPort: 30001
    protocol: TCP
  - containerPort: 30002
    hostPort: 30002
    protocol: TCP
- role: worker
  extraMounts:
  - hostPath: /tmp
    containerPath: /tmp
- role: worker
  extraMounts:
  - hostPath: /tmp
    containerPath: /tmp
EOF
    
    kind create cluster --config=/tmp/kind-config.yaml
    
    # Wait for cluster to be ready
    kubectl wait --for=condition=Ready nodes --all --timeout=60s
}

# Function to create Minikube cluster
create_minikube_cluster() {
    echo -e "${YELLOW}Creating Minikube cluster...${NC}"
    
    # Start Minikube with sufficient resources
    minikube start \
        --cpus=4 \
        --memory=8192 \
        --disk-size=50g \
        --driver=docker \
        --kubernetes-version=v1.28.3 \
        --addons=ingress,metrics-server,dashboard
    
    # Enable necessary addons
    minikube addons enable ingress
    minikube addons enable metrics-server
    minikube addons enable dashboard
}

# Function to install Istio
install_istio() {
    echo -e "${YELLOW}Installing Istio service mesh...${NC}"
    
    # Download Istio
    if [ ! -d "istio-${ISTIO_VERSION}" ]; then
        curl -L https://istio.io/downloadIstio | ISTIO_VERSION=${ISTIO_VERSION} sh -
    fi
    
    # Add istioctl to PATH
    export PATH=$PWD/istio-${ISTIO_VERSION}/bin:$PATH
    
    # Install Istio with demo profile
    istioctl install --set profile=demo -y
    
    # Enable sidecar injection for namespace
    kubectl label namespace ${NAMESPACE} istio-injection=enabled --overwrite
}

# Function to install Kong API Gateway
install_kong() {
    echo -e "${YELLOW}Installing Kong API Gateway...${NC}"
    
    # Add Kong Helm repository
    helm repo add kong https://charts.konghq.com
    helm repo update
    
    # Install Kong
    helm upgrade --install kong kong/kong \
        --namespace ${NAMESPACE} \
        --set proxy.type=NodePort \
        --set proxy.http.nodePort=30000 \
        --set proxy.tls.nodePort=30001 \
        --set admin.enabled=true \
        --set admin.type=NodePort \
        --set admin.http.nodePort=30002 \
        --set postgresql.enabled=true \
        --set postgresql.postgresqlUsername=kong \
        --set postgresql.postgresqlPassword=kong \
        --set postgresql.postgresqlDatabase=kong \
        --wait
}

# Function to install monitoring stack
install_monitoring() {
    echo -e "${YELLOW}Installing monitoring stack...${NC}"
    
    # Create monitoring namespace
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    # Add Prometheus Helm repository
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Install kube-prometheus-stack
    helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
        --set grafana.adminPassword=admin \
        --wait
    
    # Add Jaeger for distributed tracing
    kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f -
    kubectl apply -n observability -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.49.0/jaeger-operator.yaml
}

# Function to setup local registry
setup_local_registry() {
    echo -e "${YELLOW}Setting up local Docker registry...${NC}"
    
    # Check if registry already exists
    if ! docker ps | grep -q "kind-registry"; then
        docker run -d --restart=always -p "5001:5000" --name "kind-registry" registry:2
    fi
    
    # Connect registry to kind network
    if [ "$K8S_PROVIDER" = "kind" ]; then
        docker network connect "kind" "kind-registry" 2>/dev/null || true
    fi
    
    # Create configmap for registry
    kubectl create configmap local-registry-hosting \
        --from-literal="localRegistryHosting.v1=localhost:5001" \
        -n kube-public --dry-run=client -o yaml | kubectl apply -f -
}

# Function to apply base Kubernetes resources
apply_base_resources() {
    echo -e "${YELLOW}Applying base Kubernetes resources...${NC}"
    
    # Create namespace
    kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply base resources using kustomize
    kubectl apply -k ../base/
}

# Function to setup development tools
setup_dev_tools() {
    echo -e "${YELLOW}Setting up development tools...${NC}"
    
    # Install Telepresence for local development
    if ! command_exists telepresence; then
        sudo curl -fL https://app.getambassador.io/download/tel2/linux/amd64/latest/telepresence -o /usr/local/bin/telepresence
        sudo chmod +x /usr/local/bin/telepresence
    fi
    
    # Install stern for log aggregation
    if ! command_exists stern; then
        curl -L https://github.com/stern/stern/releases/download/v1.26.0/stern_1.26.0_linux_amd64.tar.gz | tar xz
        sudo mv stern /usr/local/bin/
    fi
}

# Function to display access information
display_access_info() {
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}Setup Complete!${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo
    echo -e "${BLUE}Access Information:${NC}"
    echo "- Kubernetes Dashboard: kubectl proxy & visit http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/"
    echo "- Kong Admin API: http://localhost:30002"
    echo "- Grafana: kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80"
    echo "- Prometheus: kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090"
    echo
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "- Watch all pods: kubectl get pods -A -w"
    echo "- Tail logs: stern -n ${NAMESPACE} ."
    echo "- Access shell: kubectl exec -it <pod-name> -n ${NAMESPACE} -- /bin/bash"
    echo "- Port forward: kubectl port-forward -n ${NAMESPACE} svc/<service-name> <local-port>:<service-port>"
    echo
    echo -e "${BLUE}Development Workflow:${NC}"
    echo "- Use Skaffold: skaffold dev --port-forward"
    echo "- Use Telepresence: telepresence connect"
}

# Main execution
main() {
    echo "Starting Kubernetes development environment setup..."
    
    # Install dependencies
    install_dependencies
    
    # Create cluster based on provider
    if [ "$K8S_PROVIDER" = "kind" ]; then
        create_kind_cluster
    else
        create_minikube_cluster
    fi
    
    # Setup components
    setup_local_registry
    install_istio
    install_kong
    install_monitoring
    apply_base_resources
    setup_dev_tools
    
    # Display access information
    display_access_info
}

# Run main function
main "$@"