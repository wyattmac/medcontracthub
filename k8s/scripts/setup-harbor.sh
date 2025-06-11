#!/bin/bash

# Harbor Setup Script for MedContractHub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}MedContractHub Harbor Registry Setup${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check if Helm is installed
if ! command -v helm &> /dev/null; then
    echo -e "${RED}Error: Helm is not installed${NC}"
    echo "Please install Helm: https://helm.sh/docs/intro/install/"
    exit 1
fi

# Check if kubectl is connected
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: kubectl is not connected to a cluster${NC}"
    exit 1
fi

# Add Harbor Helm repository
echo -e "${YELLOW}Adding Harbor Helm repository...${NC}"
helm repo add harbor https://helm.goharbor.io
helm repo update

# Create namespace
echo -e "${YELLOW}Creating Harbor namespace...${NC}"
kubectl apply -f k8s/base/harbor/namespace.yaml

# Create database for Harbor in PostgreSQL
echo -e "${YELLOW}Setting up Harbor databases...${NC}"
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: harbor-db-setup
  namespace: medcontracthub
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: db-setup
        image: postgres:15-alpine
        command:
        - /bin/sh
        - -c
        - |
          PGPASSWORD=\$POSTGRES_PASSWORD psql -h postgres-primary -U postgres <<SQL
          CREATE DATABASE harbor_core;
          CREATE DATABASE harbor_notary_server;
          CREATE DATABASE harbor_notary_signer;
          CREATE USER harbor WITH PASSWORD 'harbor-password';
          GRANT ALL PRIVILEGES ON DATABASE harbor_core TO harbor;
          GRANT ALL PRIVILEGES ON DATABASE harbor_notary_server TO harbor;
          GRANT ALL PRIVILEGES ON DATABASE harbor_notary_signer TO harbor;
          SQL
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-primary-secrets
              key: password
EOF

# Wait for database setup
echo -e "${YELLOW}Waiting for database setup...${NC}"
kubectl wait --for=condition=complete job/harbor-db-setup -n medcontracthub --timeout=60s

# Create S3 bucket for Harbor (if using AWS)
echo -e "${YELLOW}Note: Ensure S3 bucket 'medcontracthub-registry' exists${NC}"

# Deploy Harbor
echo -e "${YELLOW}Deploying Harbor...${NC}"
helm upgrade --install harbor harbor/harbor \
  --namespace harbor \
  --values k8s/base/harbor/values.yaml \
  --wait \
  --timeout 10m

# Wait for Harbor to be ready
echo -e "${YELLOW}Waiting for Harbor to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=harbor -n harbor --timeout=300s

# Get Harbor admin password
echo -e "${GREEN}Harbor deployment complete!${NC}"
echo ""
echo -e "${BLUE}Harbor Access Information:${NC}"
echo -e "URL: https://registry.medcontracthub.com"
echo -e "Username: admin"
echo -e "Password: (set in values.yaml or use kubectl get secret)"
echo ""

# Configure Docker to use Harbor
echo -e "${BLUE}To configure Docker to use Harbor:${NC}"
echo "1. Add registry.medcontracthub.com to your hosts file"
echo "2. Login: docker login registry.medcontracthub.com"
echo "3. Tag images: docker tag myimage:latest registry.medcontracthub.com/medcontracthub/myimage:latest"
echo "4. Push images: docker push registry.medcontracthub.com/medcontracthub/myimage:latest"