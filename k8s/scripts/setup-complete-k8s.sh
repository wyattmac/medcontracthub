#!/bin/bash

# Complete Kubernetes setup script for MedContractHub

set -euo pipefail

echo "🚀 Complete Kubernetes Setup for MedContractHub"
echo "=============================================="

# Function to check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        echo "❌ kubectl is not installed"
        exit 1
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        echo "❌ helm is not installed"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        echo "❌ Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    echo "✅ All prerequisites met"
}

# Function to create namespaces
create_namespaces() {
    echo "📁 Creating namespaces..."
    
    for ns in medcontracthub medcontract-staging medcontract-prod monitoring; do
        if ! kubectl get namespace "$ns" &> /dev/null; then
            kubectl create namespace "$ns"
            echo "✅ Created namespace: $ns"
        else
            echo "✅ Namespace already exists: $ns"
        fi
    done
    
    # Label namespaces for Istio injection
    kubectl label namespace medcontracthub istio-injection=enabled --overwrite
    kubectl label namespace medcontract-staging istio-injection=enabled --overwrite
    kubectl label namespace medcontract-prod istio-injection=enabled --overwrite
}

# Function to install storage classes
install_storage_classes() {
    echo "💾 Setting up storage classes..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  fsType: ext4
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Retain
allowVolumeExpansion: true
EOF
    
    echo "✅ Storage classes configured"
}

# Function to install Kafka (required for microservices)
install_kafka() {
    echo "📨 Installing Kafka..."
    
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo update
    
    helm upgrade --install kafka bitnami/kafka \
        --namespace medcontracthub \
        --set auth.enabled=false \
        --set externalZookeeper.servers=zookeeper:2181 \
        --set replicaCount=3 \
        --set defaultReplicationFactor=2 \
        --set offsetsTopicReplicationFactor=2 \
        --set transactionStateLogReplicationFactor=2 \
        --wait
    
    echo "✅ Kafka installed"
}

# Function to apply base resources
apply_base_resources() {
    echo "🔧 Applying base Kubernetes resources..."
    
    # Check if secrets.env exists
    if [ ! -f "k8s/base/app/secrets.env" ]; then
        echo "⚠️  Creating secrets.env from template..."
        if [ -f ".env.local" ]; then
            cp .env.local k8s/base/app/secrets.env
        else
            echo "❌ Neither k8s/base/app/secrets.env nor .env.local found"
            echo "   Please create k8s/base/app/secrets.env with your environment variables"
            exit 1
        fi
    fi
    
    # Apply all base resources
    kubectl apply -k k8s/base/
    
    echo "✅ Base resources applied"
}

# Main setup flow
main() {
    echo ""
    echo "This script will set up the complete Kubernetes environment for MedContractHub"
    echo "Including: microservices, databases, ingress, monitoring, and security"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled"
        exit 0
    fi
    
    # Run setup steps
    check_prerequisites
    create_namespaces
    install_storage_classes
    
    # Install infrastructure components
    echo ""
    echo "📦 Installing infrastructure components..."
    
    # Install Ingress Controller
    if [ -f "k8s/scripts/setup-ingress.sh" ]; then
        ./k8s/scripts/setup-ingress.sh
    fi
    
    # Install Sealed Secrets
    if [ -f "k8s/scripts/setup-sealed-secrets.sh" ]; then
        ./k8s/scripts/setup-sealed-secrets.sh
    fi
    
    # Install Kafka
    install_kafka
    
    # Apply all Kubernetes resources
    apply_base_resources
    
    # Wait for deployments
    echo ""
    echo "⏳ Waiting for all deployments to be ready..."
    kubectl wait --for=condition=available --timeout=600s deployment --all -n medcontracthub
    
    # Show status
    echo ""
    echo "📊 Deployment Status:"
    kubectl get all -n medcontracthub
    
    echo ""
    echo "🎉 Kubernetes setup complete!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Update DNS records to point to your LoadBalancer IP"
    echo "2. Create and seal your production secrets"
    echo "3. Configure monitoring dashboards"
    echo "4. Set up backup procedures"
    echo ""
    echo "🔍 Useful commands:"
    echo "  kubectl get all -n medcontracthub     # View all resources"
    echo "  kubectl logs -f deployment/ai-service -n medcontracthub    # View logs"
    echo "  kubectl port-forward svc/kong-proxy 8080:80 -n medcontracthub    # Access locally"
    echo ""
}

# Run main function
main "$@"