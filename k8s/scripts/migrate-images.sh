#!/bin/bash

# Image Migration Script - Move images from local to production registry

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SOURCE_REGISTRY="localhost:5001"
TARGET_REGISTRY="${TARGET_REGISTRY:-registry.medcontracthub.com}"
NAMESPACE="medcontracthub"
IMAGES=(
    "medcontracthub-app"
    "ocr-service"
    "ai-service"
    "analytics-service"
    "realtime-service"
    "worker-service"
    "integration-adapter"
)

echo -e "${BLUE}MedContractHub Image Migration${NC}"
echo -e "${BLUE}==============================${NC}"
echo ""
echo -e "Source: ${SOURCE_REGISTRY}"
echo -e "Target: ${TARGET_REGISTRY}/${NAMESPACE}"
echo ""

# Check if logged into target registry
echo -e "${YELLOW}Checking registry authentication...${NC}"
if ! docker login "${TARGET_REGISTRY}" --username "${REGISTRY_USERNAME:-admin}" --password-stdin <<< "${REGISTRY_PASSWORD}" 2>/dev/null; then
    echo -e "${RED}Error: Not authenticated to ${TARGET_REGISTRY}${NC}"
    echo "Please set REGISTRY_USERNAME and REGISTRY_PASSWORD environment variables"
    echo "Or run: docker login ${TARGET_REGISTRY}"
    exit 1
fi

# Migrate each image
for IMAGE in "${IMAGES[@]}"; do
    echo -e "${YELLOW}Processing ${IMAGE}...${NC}"
    
    # Get latest tag from source
    SOURCE_IMAGE="${SOURCE_REGISTRY}/${IMAGE}:latest"
    TARGET_IMAGE="${TARGET_REGISTRY}/${NAMESPACE}/${IMAGE}:latest"
    
    # Pull from source
    echo "  Pulling from source..."
    if docker pull "${SOURCE_IMAGE}"; then
        echo -e "  ${GREEN}✓ Pulled successfully${NC}"
    else
        echo -e "  ${RED}✗ Failed to pull${NC}"
        continue
    fi
    
    # Tag for target registry
    echo "  Tagging for target registry..."
    docker tag "${SOURCE_IMAGE}" "${TARGET_IMAGE}"
    
    # Also create versioned tag
    VERSION=$(date +%Y%m%d-%H%M%S)
    docker tag "${SOURCE_IMAGE}" "${TARGET_REGISTRY}/${NAMESPACE}/${IMAGE}:${VERSION}"
    
    # Push to target registry
    echo "  Pushing to target registry..."
    if docker push "${TARGET_IMAGE}" && docker push "${TARGET_REGISTRY}/${NAMESPACE}/${IMAGE}:${VERSION}"; then
        echo -e "  ${GREEN}✓ Pushed successfully${NC}"
        echo -e "  ${GREEN}  - ${TARGET_IMAGE}${NC}"
        echo -e "  ${GREEN}  - ${TARGET_REGISTRY}/${NAMESPACE}/${IMAGE}:${VERSION}${NC}"
    else
        echo -e "  ${RED}✗ Failed to push${NC}"
        continue
    fi
    
    echo ""
done

# Update Kubernetes manifests
echo -e "${YELLOW}Updating Kubernetes manifests...${NC}"

# Update kustomization.yaml to use new registry
sed -i.bak "s|${SOURCE_REGISTRY}|${TARGET_REGISTRY}/${NAMESPACE}|g" k8s/base/kustomization.yaml

echo -e "${GREEN}Image migration complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Commit the updated kustomization.yaml"
echo "2. Apply the changes: kubectl apply -k k8s/overlays/prod/"
echo "3. Verify deployments: kubectl get pods -n medcontract-prod"