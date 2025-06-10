#!/bin/bash

# Demo script to showcase the Kubernetes setup
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}MedContractHub K8s Demo${NC}"
echo -e "${BLUE}================================${NC}"
echo

# Function to wait for user
wait_for_user() {
    echo
    read -p "Press Enter to continue..."
    echo
}

# Function to run command with description
run_demo() {
    local description=$1
    local command=$2
    
    echo -e "${YELLOW}→ $description${NC}"
    echo -e "${BLUE}$ $command${NC}"
    wait_for_user
    eval $command
    echo
}

# Start demo
echo -e "${GREEN}Welcome to the MedContractHub Kubernetes Demo!${NC}"
echo "This demo will walk you through the local Kubernetes setup."
wait_for_user

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
for cmd in docker kubectl helm kind; do
    if command -v $cmd &> /dev/null; then
        echo -e "✓ $cmd is installed"
    else
        echo -e "✗ $cmd is not installed"
        exit 1
    fi
done
wait_for_user

# Show cluster status
run_demo "Check Kubernetes cluster status" \
    "kubectl cluster-info"

run_demo "List all namespaces" \
    "kubectl get namespaces"

# Deploy base resources
echo -e "${YELLOW}Deploying MedContractHub to Kubernetes...${NC}"
run_demo "Apply Kubernetes manifests" \
    "kubectl apply -k k8s/base/"

# Wait for deployments
echo -e "${YELLOW}Waiting for services to start...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/medcontracthub-app -n medcontracthub || true

# Show running services
run_demo "Show all pods in medcontracthub namespace" \
    "kubectl get pods -n medcontracthub"

run_demo "Show all services" \
    "kubectl get services -n medcontracthub"

# Test main application
echo -e "${YELLOW}Testing main application...${NC}"
run_demo "Check application health" \
    "curl -s http://localhost:31000/api/health | jq ."

# Show Kafka status
run_demo "Check Kafka brokers" \
    "kubectl get pods -n kafka"

# Show Redis status
run_demo "Check Redis cluster" \
    "kubectl get pods -n medcontracthub -l app=redis-cluster"

# Demonstrate event flow
echo -e "${YELLOW}Demonstrating event flow...${NC}"
run_demo "Publish test event through integration adapter" \
    'curl -X POST http://localhost:31080/api/events \
        -H "Content-Type: application/json" \
        -d "{\"topic\": \"app-events\", \"event\": \"demo.test\", \"data\": {\"message\": \"Hello from K8s!\"}}" | jq .'

# Show monitoring
echo -e "${YELLOW}Monitoring setup...${NC}"
echo "Available monitoring endpoints:"
echo "- Grafana: kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80"
echo "- Prometheus: kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090"
echo "- Jaeger: http://localhost:30686"
echo "- Kafka UI: http://localhost:30080"
wait_for_user

# Show logs
run_demo "Show application logs (last 10 lines)" \
    "kubectl logs -n medcontracthub deployment/medcontracthub-app --tail=10"

# Demonstrate scaling
echo -e "${YELLOW}Demonstrating scaling...${NC}"
run_demo "Scale OCR service to 3 replicas" \
    "kubectl scale deployment/ocr-service -n medcontracthub --replicas=3"

run_demo "Watch scaling in action" \
    "kubectl get pods -n medcontracthub -l app=ocr-service -w"

# Cleanup option
echo
echo -e "${YELLOW}Demo complete!${NC}"
echo
echo -e "${BLUE}To clean up the demo:${NC}"
echo "kubectl delete -k k8s/base/"
echo
echo -e "${BLUE}To access the application:${NC}"
echo "http://localhost:31000"
echo
echo -e "${BLUE}For continuous development:${NC}"
echo "skaffold dev --port-forward"
echo