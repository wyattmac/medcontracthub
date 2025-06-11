#!/bin/bash

# Quick verification script to check if Kubernetes is ready for MedContractHub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}MedContractHub Kubernetes Readiness Check${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Check kubectl
echo -n "Checking kubectl... "
if command -v kubectl &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(kubectl version --client --short 2>/dev/null || kubectl version --client | grep 'Client Version')"
else
    echo -e "${RED}✗ kubectl not found${NC}"
    echo "Please install kubectl: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# Check cluster connection
echo -n "Checking cluster connection... "
if kubectl cluster-info &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    CLUSTER_INFO=$(kubectl cluster-info | head -1)
    echo "  Connected to: $CLUSTER_INFO"
else
    echo -e "${RED}✗ Cannot connect to cluster${NC}"
    echo "  Please ensure you have a running Kubernetes cluster (kind, minikube, etc.)"
    exit 1
fi

# Check if it's a local cluster
echo -n "Checking cluster type... "
if kubectl cluster-info | grep -E "(127.0.0.1|localhost)" &> /dev/null; then
    echo -e "${GREEN}✓ Local cluster detected${NC}"
else
    echo -e "${YELLOW}⚠ Remote cluster detected${NC}"
    echo "  Make sure you're connected to the correct cluster!"
fi

# Check required tools
echo ""
echo "Checking required tools:"

# Helm
echo -n "  Helm... "
if command -v helm &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(helm version --short 2>/dev/null || echo "installed")"
else
    echo -e "${YELLOW}⚠ Not found (optional but recommended)${NC}"
fi

# Skaffold
echo -n "  Skaffold... "
if command -v skaffold &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(skaffold version)"
else
    echo -e "${YELLOW}⚠ Not found (optional for development)${NC}"
fi

# Docker
echo -n "  Docker... "
if docker info &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker daemon running"
else
    echo -e "${RED}✗ Docker not running${NC}"
    echo "    Please start Docker daemon"
fi

# Check if secrets file exists
echo ""
echo -n "Checking secrets file... "
if [ -f "k8s/base/app/secrets.env" ]; then
    echo -e "${GREEN}✓${NC} Found"
elif [ -f ".env.local" ]; then
    echo -e "${YELLOW}⚠ Not found, but .env.local exists${NC}"
    echo "  Run: cp .env.local k8s/base/app/secrets.env"
else
    echo -e "${RED}✗ No secrets file found${NC}"
    echo "  Please create k8s/base/app/secrets.env with your environment variables"
fi

# Check local registry (for development)
echo -n "Checking local registry... "
if docker ps | grep -q "registry:2" || docker ps | grep -q ":5001"; then
    echo -e "${GREEN}✓${NC} Local registry running on port 5001"
else
    echo -e "${YELLOW}⚠ Local registry not running${NC}"
    echo "  For local development, run: docker run -d -p 5001:5000 --name registry registry:2"
fi

# Check namespaces
echo ""
echo "Checking namespaces:"
for ns in medcontracthub medcontract-staging medcontract-prod; do
    echo -n "  $ns... "
    if kubectl get namespace $ns &> /dev/null; then
        echo -e "${GREEN}✓ exists${NC}"
    else
        echo -e "${YELLOW}○ not created yet${NC}"
    fi
done

# Summary
echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}=========================================${NC}"

if [ -f "k8s/base/app/secrets.env" ] && kubectl cluster-info &> /dev/null && docker info &> /dev/null; then
    echo -e "${GREEN}✓ Ready to deploy MedContractHub to Kubernetes!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run complete setup:     make k8s-setup"
    echo "2. Deploy to development:  make k8s-dev"
    echo "3. Test the deployment:    make k8s-test"
    echo "4. Access the app:         make k8s-forward SERVICE=medcontracthub-app PORT=3000"
else
    echo -e "${YELLOW}⚠ Some prerequisites are missing${NC}"
    echo ""
    echo "Please fix the issues above before proceeding."
fi

echo ""
echo "For local development with hot reload:"
echo "  make skaffold-dev"
echo ""
echo "For more information:"
echo "  See k8s/README.md and k8s/QUICK_START.md"