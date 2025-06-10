#!/bin/bash

# Setup script for NGINX Ingress Controller and cert-manager

set -euo pipefail

echo "🚀 Setting up Ingress Controller for MedContractHub..."

# Function to check if a resource exists
resource_exists() {
    kubectl get "$1" "$2" -n "$3" &> /dev/null
}

# Install NGINX Ingress Controller
echo "📦 Installing NGINX Ingress Controller..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

if ! resource_exists "namespace" "ingress-nginx" "default"; then
    kubectl create namespace ingress-nginx
fi

helm upgrade --install nginx-ingress ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --values k8s/base/ingress/nginx-ingress-values.yaml \
    --wait

echo "✅ NGINX Ingress Controller installed"

# Install cert-manager
echo "📦 Installing cert-manager..."
helm repo add jetstack https://charts.jetstack.io
helm repo update

if ! resource_exists "namespace" "cert-manager" "default"; then
    kubectl create namespace cert-manager
fi

helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --version v1.13.3 \
    --set installCRDs=true \
    --wait

echo "✅ cert-manager installed"

# Wait for cert-manager to be ready
echo "⏳ Waiting for cert-manager to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=cert-manager -n cert-manager --timeout=300s

# Apply cert-manager resources
echo "🔒 Applying cert-manager issuers and certificates..."
kubectl apply -f k8s/base/ingress/cert-manager.yaml

# Apply custom headers ConfigMap
echo "🔧 Applying custom headers..."
kubectl apply -f k8s/base/ingress/custom-headers.yaml

# Apply Ingress resources
echo "🌐 Applying Ingress resources..."
kubectl apply -f k8s/base/ingress/ingress.yaml

# Wait for LoadBalancer to get external IP
echo "⏳ Waiting for LoadBalancer to get external IP..."
for i in {1..60}; do
    EXTERNAL_IP=$(kubectl get svc nginx-ingress-ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [ -n "$EXTERNAL_IP" ]; then
        echo "✅ LoadBalancer external IP: $EXTERNAL_IP"
        break
    fi
    echo -n "."
    sleep 5
done

if [ -z "$EXTERNAL_IP" ]; then
    echo "⚠️  LoadBalancer did not get an external IP within 5 minutes"
    echo "   Check your cloud provider configuration"
    echo "   You can check the status with: kubectl get svc -n ingress-nginx"
fi

# Show ingress status
echo ""
echo "📊 Ingress Status:"
kubectl get ingress -n medcontracthub

echo ""
echo "🎉 Ingress setup complete!"
echo ""
echo "Next steps:"
echo "1. Point your DNS records to the LoadBalancer IP: $EXTERNAL_IP"
echo "2. Wait for DNS propagation (can take up to 48 hours)"
echo "3. Certificates will be automatically provisioned by cert-manager"
echo ""
echo "DNS Configuration needed:"
echo "  medcontracthub.com          → $EXTERNAL_IP"
echo "  *.medcontracthub.com        → $EXTERNAL_IP"
echo ""
echo "To check certificate status:"
echo "  kubectl get certificates -n medcontracthub"
echo "  kubectl describe certificate medcontracthub-tls -n medcontracthub"