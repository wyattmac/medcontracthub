#!/bin/bash

# Development Workflow Helper Script
# Provides common development operations for Kubernetes environment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
NAMESPACE="${NAMESPACE:-medcontracthub}"
REGISTRY="localhost:5001"

# Function to display usage
usage() {
    echo -e "${BLUE}Usage: $0 <command> [options]${NC}"
    echo
    echo "Commands:"
    echo "  build <service>     - Build and push a service image"
    echo "  deploy <service>    - Deploy a service to Kubernetes"
    echo "  logs <service>      - Tail logs for a service"
    echo "  shell <pod>         - Open shell in a pod"
    echo "  forward <service>   - Port forward to a service"
    echo "  restart <service>   - Restart a service"
    echo "  scale <service> <n> - Scale a service to n replicas"
    echo "  status              - Show cluster status"
    echo "  sync                - Sync local code to running pod"
    echo "  test <service>      - Run tests for a service"
    echo "  clean               - Clean up resources"
    echo
    exit 1
}

# Build and push service image
build_service() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${RED}Error: Service name required${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Building $service...${NC}"
    
    case $service in
        app)
            docker build -f Dockerfile.dev -t $REGISTRY/medcontracthub-app:latest .
            ;;
        ocr)
            docker build -f services/ocr-service/Dockerfile -t $REGISTRY/ocr-service:latest services/ocr-service/
            ;;
        integration)
            docker build -f services/integration-adapter/Dockerfile -t $REGISTRY/integration-adapter:latest services/integration-adapter/
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${YELLOW}Pushing image...${NC}"
    docker push $REGISTRY/$(get_image_name $service):latest
    
    echo -e "${GREEN}Build complete!${NC}"
}

# Get image name for service
get_image_name() {
    case $1 in
        app) echo "medcontracthub-app" ;;
        ocr) echo "ocr-service" ;;
        integration) echo "integration-adapter" ;;
        *) echo "$1" ;;
    esac
}

# Deploy service to Kubernetes
deploy_service() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${RED}Error: Service name required${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Deploying $service...${NC}"
    
    # Force pod restart to pull latest image
    kubectl rollout restart deployment/$(get_deployment_name $service) -n $NAMESPACE
    kubectl rollout status deployment/$(get_deployment_name $service) -n $NAMESPACE
    
    echo -e "${GREEN}Deployment complete!${NC}"
}

# Get deployment name for service
get_deployment_name() {
    case $1 in
        app) echo "medcontracthub-app" ;;
        ocr) echo "ocr-service" ;;
        integration) echo "integration-adapter" ;;
        *) echo "$1" ;;
    esac
}

# Tail logs for a service
tail_logs() {
    local service=$1
    if [ -z "$service" ]; then
        stern -n $NAMESPACE .
    else
        stern -n $NAMESPACE $(get_deployment_name $service)
    fi
}

# Open shell in pod
open_shell() {
    local pod=$1
    if [ -z "$pod" ]; then
        echo -e "${YELLOW}Available pods:${NC}"
        kubectl get pods -n $NAMESPACE
        echo
        echo -e "${BLUE}Usage: $0 shell <pod-name>${NC}"
        exit 1
    fi
    
    kubectl exec -it $pod -n $NAMESPACE -- /bin/sh
}

# Port forward to service
port_forward() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${RED}Error: Service name required${NC}"
        exit 1
    fi
    
    case $service in
        app)
            echo -e "${YELLOW}Forwarding localhost:3000 -> medcontracthub-app:3000${NC}"
            kubectl port-forward -n $NAMESPACE svc/medcontracthub-app 3000:3000
            ;;
        ocr)
            echo -e "${YELLOW}Forwarding localhost:8100 -> ocr-service:8100${NC}"
            kubectl port-forward -n $NAMESPACE svc/ocr-service 8100:8100
            ;;
        integration)
            echo -e "${YELLOW}Forwarding localhost:8080 -> integration-adapter:8080${NC}"
            kubectl port-forward -n $NAMESPACE svc/integration-adapter 8080:8080
            ;;
        kafka-ui)
            echo -e "${YELLOW}Forwarding localhost:8090 -> kafka-ui:8080${NC}"
            kubectl port-forward -n kafka svc/kafka-ui 8090:8080
            ;;
        grafana)
            echo -e "${YELLOW}Forwarding localhost:3000 -> grafana:80${NC}"
            kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
            ;;
        prometheus)
            echo -e "${YELLOW}Forwarding localhost:9090 -> prometheus:9090${NC}"
            kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            exit 1
            ;;
    esac
}

# Restart service
restart_service() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${RED}Error: Service name required${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Restarting $service...${NC}"
    kubectl rollout restart deployment/$(get_deployment_name $service) -n $NAMESPACE
    kubectl rollout status deployment/$(get_deployment_name $service) -n $NAMESPACE
    echo -e "${GREEN}Restart complete!${NC}"
}

# Scale service
scale_service() {
    local service=$1
    local replicas=$2
    
    if [ -z "$service" ] || [ -z "$replicas" ]; then
        echo -e "${RED}Error: Service name and replica count required${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Scaling $service to $replicas replicas...${NC}"
    kubectl scale deployment/$(get_deployment_name $service) -n $NAMESPACE --replicas=$replicas
    echo -e "${GREEN}Scaling complete!${NC}"
}

# Show cluster status
show_status() {
    echo -e "${BLUE}=== Cluster Status ===${NC}"
    echo
    echo -e "${YELLOW}Nodes:${NC}"
    kubectl get nodes
    echo
    echo -e "${YELLOW}Namespaces:${NC}"
    kubectl get namespaces
    echo
    echo -e "${YELLOW}Deployments ($NAMESPACE):${NC}"
    kubectl get deployments -n $NAMESPACE
    echo
    echo -e "${YELLOW}Pods ($NAMESPACE):${NC}"
    kubectl get pods -n $NAMESPACE
    echo
    echo -e "${YELLOW}Services ($NAMESPACE):${NC}"
    kubectl get services -n $NAMESPACE
    echo
    echo -e "${YELLOW}Ingresses ($NAMESPACE):${NC}"
    kubectl get ingresses -n $NAMESPACE
}

# Sync local code to running pod (for development)
sync_code() {
    echo -e "${YELLOW}Setting up Telepresence for local development...${NC}"
    
    # Check if Telepresence is connected
    if ! telepresence status | grep -q "Connected"; then
        echo "Connecting to cluster..."
        telepresence connect
    fi
    
    # Intercept traffic
    echo "Choose service to intercept:"
    echo "1) medcontracthub-app"
    echo "2) ocr-service"
    echo "3) integration-adapter"
    read -p "Selection: " choice
    
    case $choice in
        1)
            telepresence intercept medcontracthub-app --port 3000:3000 --namespace $NAMESPACE
            echo -e "${GREEN}Intercepting medcontracthub-app. Run 'npm run dev' locally.${NC}"
            ;;
        2)
            telepresence intercept ocr-service --port 8100:8100 --namespace $NAMESPACE
            echo -e "${GREEN}Intercepting ocr-service. Run the service locally on port 8100.${NC}"
            ;;
        3)
            telepresence intercept integration-adapter --port 8080:8080 --namespace $NAMESPACE
            echo -e "${GREEN}Intercepting integration-adapter. Run 'npm run dev' locally.${NC}"
            ;;
        *)
            echo -e "${RED}Invalid selection${NC}"
            exit 1
            ;;
    esac
}

# Run tests for a service
run_tests() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${RED}Error: Service name required${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Running tests for $service...${NC}"
    
    case $service in
        app)
            npm test
            ;;
        ocr)
            cd services/ocr-service && python -m pytest
            ;;
        integration)
            cd services/integration-adapter && npm test
            ;;
        e2e)
            npm run test:e2e
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            exit 1
            ;;
    esac
}

# Clean up resources
cleanup() {
    echo -e "${YELLOW}Cleaning up development resources...${NC}"
    
    # Stop Telepresence intercepts
    telepresence leave medcontracthub-app 2>/dev/null || true
    telepresence leave ocr-service 2>/dev/null || true
    telepresence leave integration-adapter 2>/dev/null || true
    
    # Clean up test data
    kubectl delete jobs -n $NAMESPACE -l test=true 2>/dev/null || true
    
    echo -e "${GREEN}Cleanup complete!${NC}"
}

# Main execution
case "${1:-}" in
    build)
        build_service "$2"
        ;;
    deploy)
        deploy_service "$2"
        ;;
    logs)
        tail_logs "$2"
        ;;
    shell)
        open_shell "$2"
        ;;
    forward)
        port_forward "$2"
        ;;
    restart)
        restart_service "$2"
        ;;
    scale)
        scale_service "$2" "$3"
        ;;
    status)
        show_status
        ;;
    sync)
        sync_code
        ;;
    test)
        run_tests "$2"
        ;;
    clean)
        cleanup
        ;;
    *)
        usage
        ;;
esac