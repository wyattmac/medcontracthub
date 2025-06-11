#!/bin/bash

# Production Deployment Script for MedContractHub Microservices
# This script handles the complete production deployment process

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="medcontract-prod"
REGISTRY="registry.medcontracthub.com"
CLUSTER_CONTEXT="medcontract-prod"
DEPLOYMENT_TIMEOUT="600s"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_DELAY=10

# Deployment settings
declare -A SERVICE_PORTS=(
    ["medcontracthub-app"]="3000"
    ["ocr-service"]="8100"
    ["ai-service"]="8200"
    ["analytics-service"]="8300"
    ["realtime-service"]="8400"
    ["worker-service"]="8500"
)

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required tools
    for tool in kubectl helm aws jq curl; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check cluster access
    if ! kubectl config get-contexts "$CLUSTER_CONTEXT" &> /dev/null; then
        error "Kubernetes context '$CLUSTER_CONTEXT' not found"
        exit 1
    fi
    
    # Switch to production context
    kubectl config use-context "$CLUSTER_CONTEXT"
    
    # Verify cluster access
    if ! kubectl get nodes &> /dev/null; then
        error "Cannot access Kubernetes cluster"
        exit 1
    fi
    
    success "Prerequisites checked"
}

verify_namespace() {
    log "Verifying namespace..."
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace '$NAMESPACE' does not exist"
        exit 1
    fi
    
    success "Namespace verified"
}

check_resource_availability() {
    log "Checking cluster resources..."
    
    # Check node resources
    local nodes_json=$(kubectl get nodes -o json)
    local total_cpu=$(echo "$nodes_json" | jq '[.items[].status.allocatable.cpu | gsub("[^0-9]";"") | tonumber] | add')
    local total_memory=$(echo "$nodes_json" | jq '[.items[].status.allocatable.memory | gsub("[^0-9]";"") | tonumber] | add / 1024 / 1024 / 1024')
    
    log "Total allocatable CPU: ${total_cpu} cores"
    log "Total allocatable Memory: ${total_memory} GB"
    
    # Check if resources are sufficient
    if [[ $(echo "$total_cpu < 20" | bc) -eq 1 ]]; then
        warning "Low CPU resources available"
    fi
    
    if [[ $(echo "$total_memory < 50" | bc) -eq 1 ]]; then
        warning "Low memory resources available"
    fi
    
    success "Resource check completed"
}

create_backup() {
    log "Creating pre-deployment backup..."
    
    # Backup current deployment configs
    local backup_dir="backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Export current deployments
    kubectl get deployments -n "$NAMESPACE" -o yaml > "$backup_dir/deployments.yaml"
    kubectl get services -n "$NAMESPACE" -o yaml > "$backup_dir/services.yaml"
    kubectl get configmaps -n "$NAMESPACE" -o yaml > "$backup_dir/configmaps.yaml"
    kubectl get secrets -n "$NAMESPACE" -o yaml > "$backup_dir/secrets.yaml"
    
    # Backup database
    log "Backing up PostgreSQL..."
    kubectl exec -n "$NAMESPACE" postgres-primary-0 -- \
        pg_dump -U postgres medcontracthub | gzip > "$backup_dir/postgres-backup.sql.gz"
    
    success "Backup created in $backup_dir"
    echo "$backup_dir"
}

run_pre_deployment_tests() {
    log "Running pre-deployment tests..."
    
    # Check database connectivity
    if ! kubectl exec -n "$NAMESPACE" postgres-primary-0 -- pg_isready -U postgres; then
        error "PostgreSQL is not ready"
        exit 1
    fi
    
    # Check Redis cluster
    if ! kubectl exec -n "$NAMESPACE" redis-cluster-0 -- redis-cli ping | grep -q PONG; then
        error "Redis cluster is not responding"
        exit 1
    fi
    
    # Check Kafka cluster
    if ! kubectl exec -n "$NAMESPACE" kafka-0 -- kafka-broker-api-versions.sh --bootstrap-server kafka:9092 &> /dev/null; then
        error "Kafka cluster is not ready"
        exit 1
    fi
    
    success "Pre-deployment tests passed"
}

deploy_infrastructure_updates() {
    log "Deploying infrastructure updates..."
    
    # Update ConfigMaps
    kubectl apply -f k8s/base/*/configmap.yaml -n "$NAMESPACE"
    
    # Update Secrets (if changed)
    # Note: In production, use sealed-secrets or external-secrets
    if [[ -f "k8s/overlays/prod/secrets-patch.yaml" ]]; then
        kubectl apply -f k8s/overlays/prod/secrets-patch.yaml -n "$NAMESPACE"
    fi
    
    # Update Network Policies
    kubectl apply -f k8s/overlays/prod/network-policies/ -n "$NAMESPACE"
    
    # Update HPA configurations
    kubectl apply -f k8s/overlays/prod/hpa-advanced.yaml -n "$NAMESPACE"
    
    success "Infrastructure updates deployed"
}

deploy_service() {
    local service=$1
    local version=$2
    
    log "Deploying $service version $version..."
    
    # Tag and push image
    docker tag "${service}:latest" "${REGISTRY}/${service}:${version}"
    docker push "${REGISTRY}/${service}:${version}"
    
    # Update deployment
    kubectl set image "deployment/${service}" \
        "${service}=${REGISTRY}/${service}:${version}" \
        -n "$NAMESPACE"
    
    # Wait for rollout
    if ! kubectl rollout status "deployment/${service}" -n "$NAMESPACE" --timeout="${DEPLOYMENT_TIMEOUT}"; then
        error "Deployment failed for $service"
        return 1
    fi
    
    # Verify health
    local port="${SERVICE_PORTS[$service]}"
    local retries=0
    
    while [[ $retries -lt $HEALTH_CHECK_RETRIES ]]; do
        if kubectl exec -n "$NAMESPACE" "deploy/${service}" -- wget -qO- "localhost:${port}/health" &> /dev/null; then
            success "$service deployed and healthy"
            return 0
        fi
        
        retries=$((retries + 1))
        log "Health check attempt $retries/$HEALTH_CHECK_RETRIES for $service"
        sleep "$HEALTH_CHECK_DELAY"
    done
    
    error "$service health check failed"
    return 1
}

deploy_services() {
    local version=$1
    local services=("${@:2}")
    
    log "Deploying services: ${services[*]}"
    
    # Deploy in specific order to respect dependencies
    local deployment_order=(
        "medcontracthub-app"
        "ocr-service"
        "ai-service"
        "analytics-service"
        "realtime-service"
        "worker-service"
    )
    
    for service in "${deployment_order[@]}"; do
        # Skip if not in services list
        if [[ ! " ${services[*]} " =~ " ${service} " ]]; then
            continue
        fi
        
        if ! deploy_service "$service" "$version"; then
            error "Failed to deploy $service"
            return 1
        fi
        
        # Brief pause between deployments
        sleep 5
    done
    
    success "All services deployed"
}

run_smoke_tests() {
    log "Running smoke tests..."
    
    # Create smoke test job
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: smoke-tests-$(date +%s)
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: smoke-tests
        image: ${REGISTRY}/test-runner:latest
        command: ["npm", "run", "test:smoke"]
        env:
        - name: API_URL
          value: "http://medcontracthub-app:3000"
        - name: ENVIRONMENT
          value: "production"
      restartPolicy: Never
  backoffLimit: 0
EOF
    
    # Wait for job completion
    local job_name=$(kubectl get jobs -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}')
    
    if kubectl wait --for=condition=complete "job/$job_name" -n "$NAMESPACE" --timeout=300s; then
        success "Smoke tests passed"
        kubectl delete "job/$job_name" -n "$NAMESPACE"
        return 0
    else
        error "Smoke tests failed"
        kubectl logs "job/$job_name" -n "$NAMESPACE"
        kubectl delete "job/$job_name" -n "$NAMESPACE"
        return 1
    fi
}

verify_deployment() {
    log "Verifying deployment..."
    
    # Check all pods are running
    local not_ready=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running -o name | wc -l)
    if [[ $not_ready -gt 0 ]]; then
        error "$not_ready pods are not running"
        kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running
        return 1
    fi
    
    # Check service endpoints
    for service in "${!SERVICE_PORTS[@]}"; do
        local endpoints=$(kubectl get endpoints "$service" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
        if [[ $endpoints -eq 0 ]]; then
            error "No endpoints for service $service"
            return 1
        fi
        log "$service has $endpoints endpoints"
    done
    
    # Check external connectivity
    local health_url="https://api.medcontracthub.com/health"
    if curl -sf "$health_url" > /dev/null; then
        success "External health check passed"
    else
        error "External health check failed"
        return 1
    fi
    
    success "Deployment verification completed"
}

update_monitoring() {
    log "Updating monitoring configurations..."
    
    # Update Prometheus alerts
    kubectl apply -f k8s/base/monitoring/production-alerts.yaml
    
    # Reload Prometheus configuration
    kubectl exec -n monitoring prometheus-0 -- kill -HUP 1
    
    # Update Grafana dashboards
    for dashboard in k8s/base/monitoring/grafana-dashboards/*.json; do
        local name=$(basename "$dashboard" .json)
        kubectl create configmap "grafana-dashboard-$name" \
            --from-file="$dashboard" \
            -n monitoring \
            --dry-run=client -o yaml | kubectl apply -f -
    done
    
    success "Monitoring updated"
}

rollback_deployment() {
    local backup_dir=$1
    
    error "Rolling back deployment using backup from $backup_dir"
    
    # Rollback deployments
    kubectl apply -f "$backup_dir/deployments.yaml"
    
    # Wait for rollback to complete
    kubectl wait --for=condition=available --timeout=300s \
        deployment --all -n "$NAMESPACE"
    
    warning "Rollback completed. Manual database restoration may be required."
}

send_notification() {
    local status=$1
    local message=$2
    
    # Send Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        [[ $status == "failure" ]] && color="danger"
        
        curl -X POST "$SLACK_WEBHOOK_URL" -H 'Content-type: application/json' \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Production Deployment $status\",
                    \"text\": \"$message\",
                    \"footer\": \"Deployed by: $(whoami)\",
                    \"ts\": $(date +%s)
                }]
            }"
    fi
}

# Main deployment flow
main() {
    local version=""
    local services=()
    local dry_run=false
    local skip_tests=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version)
                version="$2"
                shift 2
                ;;
            --services)
                IFS=',' read -ra services <<< "$2"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --skip-tests)
                skip_tests=true
                shift
                ;;
            --help)
                echo "Usage: $0 --version <version> [--services <service1,service2,...>] [--dry-run] [--skip-tests]"
                echo "  --version    Version tag for deployment (required)"
                echo "  --services   Comma-separated list of services to deploy (default: all)"
                echo "  --dry-run    Show what would be deployed without making changes"
                echo "  --skip-tests Skip pre-deployment and smoke tests"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [[ -z "$version" ]]; then
        error "Version is required. Use --version <version>"
        exit 1
    fi
    
    # Default to all services if none specified
    if [[ ${#services[@]} -eq 0 ]]; then
        services=("${!SERVICE_PORTS[@]}")
    fi
    
    log "Starting production deployment"
    log "Version: $version"
    log "Services: ${services[*]}"
    log "Dry run: $dry_run"
    
    # Deployment steps
    check_prerequisites
    verify_namespace
    check_resource_availability
    
    if [[ $dry_run == true ]]; then
        warning "DRY RUN MODE - No changes will be made"
        exit 0
    fi
    
    # Create backup
    backup_dir=$(create_backup)
    
    # Pre-deployment tests
    if [[ $skip_tests == false ]]; then
        if ! run_pre_deployment_tests; then
            error "Pre-deployment tests failed"
            exit 1
        fi
    fi
    
    # Deploy infrastructure updates
    deploy_infrastructure_updates
    
    # Deploy services
    if ! deploy_services "$version" "${services[@]}"; then
        error "Service deployment failed"
        rollback_deployment "$backup_dir"
        send_notification "failure" "Deployment failed and was rolled back"
        exit 1
    fi
    
    # Run smoke tests
    if [[ $skip_tests == false ]]; then
        if ! run_smoke_tests; then
            error "Smoke tests failed"
            rollback_deployment "$backup_dir"
            send_notification "failure" "Smoke tests failed, deployment rolled back"
            exit 1
        fi
    fi
    
    # Verify deployment
    if ! verify_deployment; then
        error "Deployment verification failed"
        rollback_deployment "$backup_dir"
        send_notification "failure" "Deployment verification failed, rolled back"
        exit 1
    fi
    
    # Update monitoring
    update_monitoring
    
    success "Production deployment completed successfully!"
    send_notification "success" "Version $version deployed successfully to production"
}

# Run main function
main "$@"