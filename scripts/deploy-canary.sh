#!/bin/bash

# Canary Deployment Script for MedContractHub
# Gradually rolls out new versions with automated rollback on failures

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
PROMETHEUS_URL="http://prometheus.monitoring.svc.cluster.local:9090"
CANARY_STEPS=(10 25 50 75 100)
CANARY_INTERVAL=300  # 5 minutes between steps
ERROR_THRESHOLD=0.01  # 1% error rate threshold
LATENCY_THRESHOLD=2.0 # 2 second p95 latency threshold

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

query_prometheus() {
    local query=$1
    local result=$(curl -s -G "${PROMETHEUS_URL}/api/v1/query" \
        --data-urlencode "query=${query}" | \
        jq -r '.data.result[0].value[1]')
    
    if [[ "$result" == "null" ]]; then
        echo "0"
    else
        echo "$result"
    fi
}

check_canary_metrics() {
    local service=$1
    local canary_percentage=$2
    
    log "Checking canary metrics for $service at ${canary_percentage}% traffic..."
    
    # Check error rate
    local error_rate=$(query_prometheus "
        rate(http_requests_total{job=\"${service}-canary\",status=~\"5..\"}[5m]) / 
        rate(http_requests_total{job=\"${service}-canary\"}[5m])
    ")
    
    # Check p95 latency
    local latency=$(query_prometheus "
        histogram_quantile(0.95, 
            sum(rate(http_request_duration_seconds_bucket{job=\"${service}-canary\"}[5m])) 
            by (le)
        )
    ")
    
    log "Canary error rate: ${error_rate}"
    log "Canary p95 latency: ${latency}s"
    
    # Compare with baseline
    local baseline_error_rate=$(query_prometheus "
        rate(http_requests_total{job=\"${service}\",status=~\"5..\"}[5m]) / 
        rate(http_requests_total{job=\"${service}\"}[5m])
    ")
    
    local baseline_latency=$(query_prometheus "
        histogram_quantile(0.95, 
            sum(rate(http_request_duration_seconds_bucket{job=\"${service}\"}[5m])) 
            by (le)
        )
    ")
    
    log "Baseline error rate: ${baseline_error_rate}"
    log "Baseline p95 latency: ${baseline_latency}s"
    
    # Check thresholds
    if (( $(echo "$error_rate > $ERROR_THRESHOLD" | bc -l) )); then
        error "Canary error rate ${error_rate} exceeds threshold ${ERROR_THRESHOLD}"
        return 1
    fi
    
    if (( $(echo "$latency > $LATENCY_THRESHOLD" | bc -l) )); then
        error "Canary latency ${latency}s exceeds threshold ${LATENCY_THRESHOLD}s"
        return 1
    fi
    
    # Check regression
    local error_increase=$(echo "scale=4; ($error_rate - $baseline_error_rate) / $baseline_error_rate" | bc -l)
    local latency_increase=$(echo "scale=4; ($latency - $baseline_latency) / $baseline_latency" | bc -l)
    
    if (( $(echo "$error_increase > 0.5" | bc -l) )); then
        error "Canary error rate increased by ${error_increase}% compared to baseline"
        return 1
    fi
    
    if (( $(echo "$latency_increase > 0.5" | bc -l) )); then
        error "Canary latency increased by ${latency_increase}% compared to baseline"
        return 1
    fi
    
    success "Canary metrics within acceptable range"
    return 0
}

create_canary_deployment() {
    local service=$1
    local version=$2
    
    log "Creating canary deployment for $service:$version..."
    
    # Get current deployment
    kubectl get deployment "$service" -n "$NAMESPACE" -o yaml > "/tmp/${service}-deployment.yaml"
    
    # Create canary deployment
    cat "/tmp/${service}-deployment.yaml" | \
        sed "s/name: ${service}/name: ${service}-canary/g" | \
        sed "s|image: .*|image: ${REGISTRY}/${service}:${version}|g" | \
        yq eval '.metadata.labels.version = "canary"' - | \
        yq eval '.spec.selector.matchLabels.version = "canary"' - | \
        yq eval '.spec.template.metadata.labels.version = "canary"' - | \
        yq eval '.spec.replicas = 1' - | \
        kubectl apply -f -
    
    # Wait for canary to be ready
    kubectl wait --for=condition=available --timeout=300s \
        deployment/"${service}-canary" -n "$NAMESPACE"
    
    success "Canary deployment created"
}

update_traffic_split() {
    local service=$1
    local canary_percentage=$2
    local stable_percentage=$((100 - canary_percentage))
    
    log "Updating traffic split: ${stable_percentage}% stable, ${canary_percentage}% canary..."
    
    # Create or update VirtualService for traffic splitting
    cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ${service}-canary
  namespace: ${NAMESPACE}
spec:
  hosts:
  - ${service}
  http:
  - match:
    - headers:
        x-canary:
          exact: "true"
    route:
    - destination:
        host: ${service}
        subset: canary
      weight: 100
  - route:
    - destination:
        host: ${service}
        subset: stable
      weight: ${stable_percentage}
    - destination:
        host: ${service}
        subset: canary
      weight: ${canary_percentage}
EOF
    
    # Create or update DestinationRule
    cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: ${service}-canary
  namespace: ${NAMESPACE}
spec:
  host: ${service}
  subsets:
  - name: stable
    labels:
      version: stable
  - name: canary
    labels:
      version: canary
EOF
    
    success "Traffic split updated"
}

promote_canary() {
    local service=$1
    local version=$2
    
    log "Promoting canary to stable..."
    
    # Update stable deployment with canary image
    kubectl set image "deployment/${service}" \
        "${service}=${REGISTRY}/${service}:${version}" \
        -n "$NAMESPACE"
    
    # Wait for rollout
    kubectl rollout status "deployment/${service}" -n "$NAMESPACE" --timeout=600s
    
    # Remove canary deployment
    kubectl delete deployment "${service}-canary" -n "$NAMESPACE" --ignore-not-found=true
    
    # Remove traffic management rules
    kubectl delete virtualservice "${service}-canary" -n "$NAMESPACE" --ignore-not-found=true
    kubectl delete destinationrule "${service}-canary" -n "$NAMESPACE" --ignore-not-found=true
    
    success "Canary promoted to stable"
}

rollback_canary() {
    local service=$1
    
    error "Rolling back canary deployment for $service..."
    
    # Remove all canary traffic
    update_traffic_split "$service" 0
    
    # Delete canary deployment
    kubectl delete deployment "${service}-canary" -n "$NAMESPACE" --ignore-not-found=true
    
    # Remove traffic management rules
    kubectl delete virtualservice "${service}-canary" -n "$NAMESPACE" --ignore-not-found=true
    kubectl delete destinationrule "${service}-canary" -n "$NAMESPACE" --ignore-not-found=true
    
    warning "Canary deployment rolled back"
}

run_canary_deployment() {
    local service=$1
    local version=$2
    local auto_promote=${3:-true}
    
    log "Starting canary deployment for $service:$version"
    
    # Create canary deployment
    create_canary_deployment "$service" "$version"
    
    # Progressive traffic shifting
    for percentage in "${CANARY_STEPS[@]}"; do
        log "Shifting ${percentage}% traffic to canary..."
        
        update_traffic_split "$service" "$percentage"
        
        # Wait for metrics to stabilize
        log "Waiting ${CANARY_INTERVAL} seconds for metrics to stabilize..."
        sleep "$CANARY_INTERVAL"
        
        # Check canary health
        if ! check_canary_metrics "$service" "$percentage"; then
            error "Canary health check failed at ${percentage}% traffic"
            rollback_canary "$service"
            return 1
        fi
        
        # Manual approval for critical services
        if [[ "$auto_promote" == "false" && "$percentage" -lt 100 ]]; then
            warning "Manual approval required to continue"
            read -p "Continue to next stage? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                rollback_canary "$service"
                return 1
            fi
        fi
    done
    
    # Final promotion
    if [[ "$auto_promote" == "true" ]]; then
        log "Auto-promoting canary after successful validation..."
        promote_canary "$service" "$version"
    else
        warning "Manual promotion required"
        read -p "Promote canary to stable? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            promote_canary "$service" "$version"
        else
            rollback_canary "$service"
            return 1
        fi
    fi
    
    success "Canary deployment completed successfully!"
}

# Main function
main() {
    local service=""
    local version=""
    local auto_promote=true
    
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
            --manual)
                auto_promote=false
                shift
                ;;
            --steps)
                IFS=',' read -ra CANARY_STEPS <<< "$2"
                shift 2
                ;;
            --interval)
                CANARY_INTERVAL="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 --service <service> --version <version> [options]"
                echo "Options:"
                echo "  --service    Service name (required)"
                echo "  --version    Version tag (required)"
                echo "  --manual     Require manual approval at each stage"
                echo "  --steps      Comma-separated canary percentages (default: 10,25,50,75,100)"
                echo "  --interval   Seconds between stages (default: 300)"
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
    
    # Run canary deployment
    if run_canary_deployment "$service" "$version" "$auto_promote"; then
        exit 0
    else
        exit 1
    fi
}

# Run main
main "$@"