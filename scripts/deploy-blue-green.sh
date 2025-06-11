#!/bin/bash

# Blue-Green Deployment Script for MedContractHub
# Zero-downtime deployment with instant rollback capability

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE="medcontract-prod"
REGISTRY="registry.medcontracthub.com"
HEALTH_CHECK_TIMEOUT=300
SMOKE_TEST_TIMEOUT=300
DNS_PROPAGATION_WAIT=60

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

get_active_color() {
    local service=$1
    
    # Check which color is currently active
    local selector=$(kubectl get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.selector.color}' 2>/dev/null)
    
    if [[ "$selector" == "blue" ]]; then
        echo "blue"
    elif [[ "$selector" == "green" ]]; then
        echo "green"
    else
        # No color set, default to blue
        echo "blue"
    fi
}

get_inactive_color() {
    local active_color=$1
    
    if [[ "$active_color" == "blue" ]]; then
        echo "green"
    else
        echo "blue"
    fi
}

create_deployment() {
    local service=$1
    local version=$2
    local color=$3
    
    log "Creating $color deployment for $service:$version..."
    
    # Get base deployment configuration
    local base_deployment="/tmp/${service}-base.yaml"
    kubectl get deployment "$service" -n "$NAMESPACE" -o yaml > "$base_deployment" 2>/dev/null || {
        error "Base deployment for $service not found"
        return 1
    }
    
    # Create colored deployment
    cat "$base_deployment" | \
        sed "s/name: ${service}/name: ${service}-${color}/g" | \
        yq eval ".metadata.labels.color = \"${color}\"" - | \
        yq eval ".spec.selector.matchLabels.color = \"${color}\"" - | \
        yq eval ".spec.template.metadata.labels.color = \"${color}\"" - | \
        yq eval ".spec.template.spec.containers[0].image = \"${REGISTRY}/${service}:${version}\"" - | \
        kubectl apply -f -
    
    # Wait for deployment to be ready
    if ! kubectl wait --for=condition=available --timeout="${HEALTH_CHECK_TIMEOUT}s" \
        deployment/"${service}-${color}" -n "$NAMESPACE"; then
        error "$color deployment failed to become ready"
        return 1
    fi
    
    success "$color deployment created and ready"
}

run_health_checks() {
    local service=$1
    local color=$2
    
    log "Running health checks on $color deployment..."
    
    # Get pods for the deployment
    local pods=$(kubectl get pods -n "$NAMESPACE" \
        -l "app=${service},color=${color}" \
        -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -z "$pods" ]]; then
        error "No pods found for ${service}-${color}"
        return 1
    fi
    
    # Check each pod
    for pod in $pods; do
        log "Checking pod $pod..."
        
        # Check pod status
        local status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        if [[ "$status" != "Running" ]]; then
            error "Pod $pod is not running (status: $status)"
            return 1
        fi
        
        # Check health endpoint
        if ! kubectl exec "$pod" -n "$NAMESPACE" -- wget -qO- localhost:8080/health &>/dev/null; then
            error "Health check failed for pod $pod"
            return 1
        fi
    done
    
    success "All health checks passed"
}

run_smoke_tests() {
    local service=$1
    local color=$2
    
    log "Running smoke tests on $color deployment..."
    
    # Create smoke test job
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: smoke-test-${service}-${color}-$(date +%s)
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: smoke-test
        image: ${REGISTRY}/test-runner:latest
        command: ["npm", "run", "test:smoke"]
        env:
        - name: TARGET_SERVICE
          value: "${service}-${color}"
        - name: TARGET_COLOR
          value: "${color}"
        - name: SERVICE_URL
          value: "http://${service}-${color}:8080"
      restartPolicy: Never
  backoffLimit: 0
EOF
    
    # Wait for job completion
    local job_name=$(kubectl get jobs -n "$NAMESPACE" \
        --sort-by=.metadata.creationTimestamp \
        -o jsonpath='{.items[-1].metadata.name}')
    
    if kubectl wait --for=condition=complete "job/$job_name" \
        -n "$NAMESPACE" --timeout="${SMOKE_TEST_TIMEOUT}s"; then
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

switch_traffic() {
    local service=$1
    local target_color=$2
    
    log "Switching traffic to $target_color deployment..."
    
    # Update service selector
    kubectl patch service "$service" -n "$NAMESPACE" -p \
        "{\"spec\":{\"selector\":{\"app\":\"${service}\",\"color\":\"${target_color}\"}}}"
    
    # Update ingress if exists
    local ingress="${service}-ingress"
    if kubectl get ingress "$ingress" -n "$NAMESPACE" &>/dev/null; then
        kubectl annotate ingress "$ingress" -n "$NAMESPACE" \
            "nginx.ingress.kubernetes.io/backend-protocol=HTTP" \
            "medcontracthub.com/active-color=${target_color}" \
            --overwrite
    fi
    
    success "Traffic switched to $target_color"
}

verify_traffic_switch() {
    local service=$1
    local expected_color=$2
    
    log "Verifying traffic is routed to $expected_color..."
    
    # Check service endpoints
    local endpoints=$(kubectl get endpoints "$service" -n "$NAMESPACE" -o json | \
        jq -r '.subsets[].addresses[].targetRef.name')
    
    for endpoint in $endpoints; do
        local pod_color=$(kubectl get pod "$endpoint" -n "$NAMESPACE" \
            -o jsonpath='{.metadata.labels.color}')
        
        if [[ "$pod_color" != "$expected_color" ]]; then
            error "Pod $endpoint has color $pod_color, expected $expected_color"
            return 1
        fi
    done
    
    # Test actual traffic routing
    local test_response=$(kubectl run test-curl-$(date +%s) \
        --image=curlimages/curl \
        --rm -it --restart=Never \
        -n "$NAMESPACE" \
        -- curl -s "http://${service}:8080/health" | \
        jq -r '.deployment_color' 2>/dev/null || echo "")
    
    if [[ "$test_response" == "$expected_color" ]]; then
        success "Traffic correctly routed to $expected_color"
        return 0
    else
        warning "Could not verify traffic routing via health endpoint"
        return 0  # Non-fatal
    fi
}

cleanup_old_deployment() {
    local service=$1
    local old_color=$2
    local keep_old=${3:-false}
    
    if [[ "$keep_old" == "true" ]]; then
        log "Keeping $old_color deployment for fast rollback"
        
        # Scale down old deployment to save resources
        kubectl scale deployment "${service}-${old_color}" \
            --replicas=0 -n "$NAMESPACE"
    else
        log "Removing $old_color deployment..."
        
        kubectl delete deployment "${service}-${old_color}" \
            -n "$NAMESPACE" --ignore-not-found=true
    fi
}

rollback() {
    local service=$1
    local previous_color=$2
    
    error "Rolling back to $previous_color deployment..."
    
    # Check if previous deployment exists
    if ! kubectl get deployment "${service}-${previous_color}" -n "$NAMESPACE" &>/dev/null; then
        error "Previous deployment ${service}-${previous_color} not found"
        return 1
    fi
    
    # Scale up previous deployment if needed
    local replicas=$(kubectl get deployment "${service}-${previous_color}" \
        -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
    
    if [[ "$replicas" -eq 0 ]]; then
        kubectl scale deployment "${service}-${previous_color}" \
            --replicas=3 -n "$NAMESPACE"
        
        kubectl wait --for=condition=available --timeout=300s \
            deployment/"${service}-${previous_color}" -n "$NAMESPACE"
    fi
    
    # Switch traffic back
    switch_traffic "$service" "$previous_color"
    
    warning "Rollback completed"
}

perform_blue_green_deployment() {
    local service=$1
    local version=$2
    local keep_old=${3:-false}
    
    log "Starting blue-green deployment for $service:$version"
    
    # Determine active and target colors
    local active_color=$(get_active_color "$service")
    local target_color=$(get_inactive_color "$active_color")
    
    log "Active color: $active_color, Target color: $target_color"
    
    # Create new colored deployment
    if ! create_deployment "$service" "$version" "$target_color"; then
        error "Failed to create $target_color deployment"
        return 1
    fi
    
    # Run health checks
    if ! run_health_checks "$service" "$target_color"; then
        error "Health checks failed"
        kubectl delete deployment "${service}-${target_color}" -n "$NAMESPACE"
        return 1
    fi
    
    # Run smoke tests
    if ! run_smoke_tests "$service" "$target_color"; then
        error "Smoke tests failed"
        kubectl delete deployment "${service}-${target_color}" -n "$NAMESPACE"
        return 1
    fi
    
    # Switch traffic to new deployment
    switch_traffic "$service" "$target_color"
    
    # Wait for DNS propagation
    log "Waiting ${DNS_PROPAGATION_WAIT}s for DNS propagation..."
    sleep "$DNS_PROPAGATION_WAIT"
    
    # Verify traffic switch
    if ! verify_traffic_switch "$service" "$target_color"; then
        error "Traffic verification failed"
        rollback "$service" "$active_color"
        return 1
    fi
    
    # Monitor for issues
    log "Monitoring new deployment for 2 minutes..."
    local monitor_end=$(($(date +%s) + 120))
    
    while [[ $(date +%s) -lt $monitor_end ]]; do
        # Check error rate
        local error_count=$(kubectl logs -n "$NAMESPACE" \
            -l "app=${service},color=${target_color}" \
            --since=30s --all-containers=true | \
            grep -ci "error\|exception" || true)
        
        if [[ $error_count -gt 10 ]]; then
            error "High error rate detected"
            rollback "$service" "$active_color"
            return 1
        fi
        
        sleep 10
    done
    
    # Cleanup old deployment
    cleanup_old_deployment "$service" "$active_color" "$keep_old"
    
    success "Blue-green deployment completed successfully!"
    log "New active color: $target_color"
}

# Main function
main() {
    local service=""
    local version=""
    local keep_old=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --service)
                service="$2"
                shift 2
                ;;
            --version)
                version="$2"
                shift 2
                ;;
            --keep-old)
                keep_old=true
                shift
                ;;
            --help)
                echo "Usage: $0 --service <service> --version <version> [--keep-old]"
                echo "Options:"
                echo "  --service   Service name (required)"
                echo "  --version   Version tag (required)"
                echo "  --keep-old  Keep old deployment for fast rollback"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Validate arguments
    if [[ -z "$service" || -z "$version" ]]; then
        error "Service and version are required"
        exit 1
    fi
    
    # Check prerequisites
    if ! command -v yq &> /dev/null; then
        error "yq is required for YAML manipulation"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        error "jq is required for JSON parsing"
        exit 1
    fi
    
    # Perform deployment
    if perform_blue_green_deployment "$service" "$version" "$keep_old"; then
        exit 0
    else
        exit 1
    fi
}

# Run main
main "$@"