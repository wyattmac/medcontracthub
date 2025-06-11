#!/bin/bash

# Production Rollback Script for MedContractHub
# Emergency rollback procedures with various strategies

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE="medcontract-prod"
BACKUP_DIR="/var/backups/medcontracthub"
MAX_ROLLBACK_HISTORY=10

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
    log "Checking prerequisites for rollback..."
    
    # Verify cluster access
    if ! kubectl get nodes &> /dev/null; then
        error "Cannot access Kubernetes cluster"
        exit 1
    fi
    
    # Verify namespace
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace $NAMESPACE not found"
        exit 1
    fi
    
    success "Prerequisites verified"
}

list_rollback_options() {
    local service=$1
    
    log "Available rollback options for $service:"
    
    # List deployment revisions
    echo -e "\n${YELLOW}Deployment Revisions:${NC}"
    kubectl rollout history deployment/"$service" -n "$NAMESPACE" | tail -n +2
    
    # List available backups
    if [[ -d "$BACKUP_DIR" ]]; then
        echo -e "\n${YELLOW}Available Backups:${NC}"
        ls -la "$BACKUP_DIR" | grep "$service" | tail -10
    fi
    
    # Check for blue-green deployments
    local blue_exists=$(kubectl get deployment "${service}-blue" -n "$NAMESPACE" 2>/dev/null || echo "")
    local green_exists=$(kubectl get deployment "${service}-green" -n "$NAMESPACE" 2>/dev/null || echo "")
    
    if [[ -n "$blue_exists" || -n "$green_exists" ]]; then
        echo -e "\n${YELLOW}Blue-Green Deployments:${NC}"
        [[ -n "$blue_exists" ]] && echo "- ${service}-blue available"
        [[ -n "$green_exists" ]] && echo "- ${service}-green available"
    fi
}

rollback_deployment() {
    local service=$1
    local revision=${2:-0}
    
    log "Rolling back $service deployment..."
    
    if [[ $revision -eq 0 ]]; then
        # Rollback to previous version
        kubectl rollout undo deployment/"$service" -n "$NAMESPACE"
    else
        # Rollback to specific revision
        kubectl rollout undo deployment/"$service" --to-revision="$revision" -n "$NAMESPACE"
    fi
    
    # Wait for rollback to complete
    if kubectl rollout status deployment/"$service" -n "$NAMESPACE" --timeout=600s; then
        success "Deployment rollback completed"
        return 0
    else
        error "Deployment rollback failed"
        return 1
    fi
}

rollback_with_backup() {
    local service=$1
    local backup_timestamp=$2
    
    log "Rolling back $service using backup from $backup_timestamp..."
    
    local backup_file="${BACKUP_DIR}/${backup_timestamp}/${service}-deployment.yaml"
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    # Apply backup configuration
    kubectl apply -f "$backup_file"
    
    # Wait for deployment
    if kubectl rollout status deployment/"$service" -n "$NAMESPACE" --timeout=600s; then
        success "Backup restoration completed"
        return 0
    else
        error "Backup restoration failed"
        return 1
    fi
}

rollback_database() {
    local backup_timestamp=$1
    
    warning "Database rollback requested for backup: $backup_timestamp"
    
    # Confirm database rollback
    read -p "Database rollback is destructive. Are you sure? (yes/no) " -r
    if [[ ! $REPLY == "yes" ]]; then
        log "Database rollback cancelled"
        return 1
    fi
    
    log "Stopping all application services..."
    kubectl scale deployment --all --replicas=0 -n "$NAMESPACE"
    
    # Wait for pods to terminate
    kubectl wait --for=delete pod -l app -n "$NAMESPACE" --timeout=300s
    
    log "Restoring database from backup..."
    local backup_file="${BACKUP_DIR}/${backup_timestamp}/postgres-backup.sql.gz"
    
    if [[ ! -f "$backup_file" ]]; then
        error "Database backup not found: $backup_file"
        kubectl scale deployment --all --replicas=3 -n "$NAMESPACE"
        return 1
    fi
    
    # Drop and recreate database
    kubectl exec -n "$NAMESPACE" postgres-primary-0 -- \
        psql -U postgres -c "DROP DATABASE IF EXISTS medcontracthub;"
    kubectl exec -n "$NAMESPACE" postgres-primary-0 -- \
        psql -U postgres -c "CREATE DATABASE medcontracthub;"
    
    # Restore backup
    gunzip -c "$backup_file" | kubectl exec -i -n "$NAMESPACE" postgres-primary-0 -- \
        psql -U postgres medcontracthub
    
    log "Restarting application services..."
    kubectl scale deployment --all --replicas=3 -n "$NAMESPACE"
    
    success "Database rollback completed"
}

rollback_configuration() {
    local resource_type=$1
    local resource_name=$2
    local backup_timestamp=$3
    
    log "Rolling back $resource_type/$resource_name configuration..."
    
    local backup_file="${BACKUP_DIR}/${backup_timestamp}/${resource_type}-${resource_name}.yaml"
    
    if [[ ! -f "$backup_file" ]]; then
        error "Configuration backup not found: $backup_file"
        return 1
    fi
    
    # Apply backup
    kubectl apply -f "$backup_file"
    
    success "Configuration rollback completed"
}

emergency_rollback() {
    local services=("$@")
    
    error "EMERGENCY ROLLBACK INITIATED"
    warning "This will rollback all specified services to their previous versions"
    
    # Confirm emergency rollback
    read -p "Proceed with emergency rollback? (yes/no) " -r
    if [[ ! $REPLY == "yes" ]]; then
        log "Emergency rollback cancelled"
        return 1
    fi
    
    # Create emergency backup first
    local emergency_backup="${BACKUP_DIR}/emergency-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$emergency_backup"
    
    log "Creating emergency backup..."
    for service in "${services[@]}"; do
        kubectl get deployment "$service" -n "$NAMESPACE" -o yaml > \
            "${emergency_backup}/${service}-deployment.yaml"
    done
    
    # Rollback each service
    local failed_services=()
    for service in "${services[@]}"; do
        log "Rolling back $service..."
        if ! rollback_deployment "$service"; then
            failed_services+=("$service")
        fi
    done
    
    # Report results
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        success "All services rolled back successfully"
        return 0
    else
        error "Failed to rollback: ${failed_services[*]}"
        return 1
    fi
}

verify_rollback() {
    local service=$1
    
    log "Verifying rollback for $service..."
    
    # Check deployment status
    local ready=$(kubectl get deployment "$service" -n "$NAMESPACE" \
        -o jsonpath='{.status.readyReplicas}')
    local desired=$(kubectl get deployment "$service" -n "$NAMESPACE" \
        -o jsonpath='{.spec.replicas}')
    
    if [[ "$ready" != "$desired" ]]; then
        error "Deployment not fully ready: $ready/$desired replicas"
        return 1
    fi
    
    # Check pod health
    local pods=$(kubectl get pods -n "$NAMESPACE" -l "app=$service" \
        -o jsonpath='{.items[*].metadata.name}')
    
    for pod in $pods; do
        if ! kubectl exec "$pod" -n "$NAMESPACE" -- wget -qO- localhost:8080/health &>/dev/null; then
            error "Health check failed for pod $pod"
            return 1
        fi
    done
    
    # Check recent errors
    local error_count=$(kubectl logs -n "$NAMESPACE" -l "app=$service" \
        --since=5m --all-containers=true | grep -ci "error\|exception" || true)
    
    if [[ $error_count -gt 50 ]]; then
        warning "High error count detected: $error_count errors in last 5 minutes"
    fi
    
    success "Rollback verification completed"
}

create_rollback_report() {
    local rollback_id=$1
    local services=("${@:2}")
    
    local report_file="${BACKUP_DIR}/rollback-report-${rollback_id}.txt"
    
    cat > "$report_file" <<EOF
ROLLBACK REPORT
===============
ID: $rollback_id
Date: $(date)
User: $(whoami)
Services: ${services[*]}

DEPLOYMENT STATUS:
EOF
    
    for service in "${services[@]}"; do
        echo -e "\n$service:" >> "$report_file"
        kubectl get deployment "$service" -n "$NAMESPACE" >> "$report_file"
        kubectl describe deployment "$service" -n "$NAMESPACE" | grep -A5 "Conditions:" >> "$report_file"
    done
    
    echo -e "\nPOD STATUS:" >> "$report_file"
    kubectl get pods -n "$NAMESPACE" -l "app in (${services[*]})" >> "$report_file"
    
    log "Rollback report saved to: $report_file"
}

# Main function
main() {
    local mode="deployment"
    local service=""
    local revision=""
    local backup_timestamp=""
    local emergency=false
    local services=()
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --service)
                service="$2"
                shift 2
                ;;
            --revision)
                revision="$2"
                shift 2
                ;;
            --backup)
                backup_timestamp="$2"
                mode="backup"
                shift 2
                ;;
            --database)
                mode="database"
                backup_timestamp="$2"
                shift 2
                ;;
            --emergency)
                emergency=true
                shift
                while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
                    services+=("$1")
                    shift
                done
                ;;
            --list)
                mode="list"
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --service <name>     Service to rollback"
                echo "  --revision <number>  Specific revision to rollback to"
                echo "  --backup <timestamp> Restore from backup"
                echo "  --database <timestamp> Rollback database"
                echo "  --emergency <services...> Emergency rollback multiple services"
                echo "  --list              List available rollback options"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check prerequisites
    check_prerequisites
    
    # Execute based on mode
    if [[ "$emergency" == "true" ]]; then
        if [[ ${#services[@]} -eq 0 ]]; then
            error "No services specified for emergency rollback"
            exit 1
        fi
        emergency_rollback "${services[@]}"
        create_rollback_report "emergency-$(date +%s)" "${services[@]}"
    elif [[ "$mode" == "list" ]]; then
        if [[ -z "$service" ]]; then
            error "Service name required for listing options"
            exit 1
        fi
        list_rollback_options "$service"
    elif [[ "$mode" == "deployment" ]]; then
        if [[ -z "$service" ]]; then
            error "Service name required for deployment rollback"
            exit 1
        fi
        rollback_deployment "$service" "${revision:-0}"
        verify_rollback "$service"
        create_rollback_report "deployment-$(date +%s)" "$service"
    elif [[ "$mode" == "backup" ]]; then
        if [[ -z "$service" || -z "$backup_timestamp" ]]; then
            error "Service and backup timestamp required"
            exit 1
        fi
        rollback_with_backup "$service" "$backup_timestamp"
        verify_rollback "$service"
        create_rollback_report "backup-$(date +%s)" "$service"
    elif [[ "$mode" == "database" ]]; then
        if [[ -z "$backup_timestamp" ]]; then
            error "Backup timestamp required for database rollback"
            exit 1
        fi
        rollback_database "$backup_timestamp"
        create_rollback_report "database-$(date +%s)" "database"
    fi
    
    # Send notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST "$SLACK_WEBHOOK_URL" -H 'Content-type: application/json' \
            -d "{\"text\": \"Rollback completed: $mode for ${service:-all}\"}"
    fi
}

# Run main
main "$@"