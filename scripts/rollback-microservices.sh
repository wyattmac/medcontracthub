#!/bin/bash

# Rollback Script for MedContractHub Microservices
# Provides service-by-service and full system rollback capabilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-medcontracthub}"
KAFKA_NAMESPACE="${KAFKA_NAMESPACE:-medcontracthub}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
LOG_FILE="rollback_$(date +%Y%m%d_%H%M%S).log"

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] <service|all> <version>

Rollback MedContractHub microservices to a previous version

Services:
  ocr-service         OCR document processing service
  ai-service          AI/ML orchestration service
  analytics-service   ClickHouse analytics service
  realtime-service    WebSocket real-time service
  worker-service      Background job worker service
  api-gateway         Kong API gateway
  all                 Rollback all services

Options:
  -d, --dry-run       Show what would be done without executing
  -t, --timestamp     Rollback to specific timestamp (for Kafka/ClickHouse)
  -b, --backup        Use specific backup ID
  -f, --force         Force rollback without confirmation
  -h, --help          Show this help message

Examples:
  $0 ocr-service v1.2.3
  $0 -t "2024-01-15 10:00:00" analytics-service v1.2.3
  $0 -d all v1.2.3
  $0 -b backup-20240115 ai-service v1.2.3
EOF
}

# Parse command line arguments
DRY_RUN=false
FORCE=false
ROLLBACK_TIMESTAMP=""
BACKUP_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -t|--timestamp)
            ROLLBACK_TIMESTAMP="$2"
            shift 2
            ;;
        -b|--backup)
            BACKUP_ID="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            break
            ;;
    esac
done

SERVICE="${1:-}"
VERSION="${2:-}"

if [[ -z "$SERVICE" ]] || [[ -z "$VERSION" ]]; then
    echo -e "${RED}Error: Service and version are required${NC}"
    usage
    exit 1
fi

# Function to confirm action
confirm() {
    if [[ "$FORCE" == "true" ]]; then
        return 0
    fi
    
    echo -e "${YELLOW}Warning: This will rollback $SERVICE to version $VERSION${NC}"
    echo -e "${YELLOW}This action may cause temporary service disruption.${NC}"
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "${RED}Rollback cancelled by user${NC}"
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log "${BLUE}Checking prerequisites...${NC}"
    
    # Check kubectl access
    if ! kubectl get nodes &>/dev/null; then
        log "${RED}Error: Cannot access Kubernetes cluster${NC}"
        exit 1
    }
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
        log "${RED}Error: Namespace $NAMESPACE does not exist${NC}"
        exit 1
    }
    
    # Check if service exists (unless rolling back all)
    if [[ "$SERVICE" != "all" ]]; then
        if ! kubectl get deployment "$SERVICE" -n "$NAMESPACE" &>/dev/null; then
            log "${RED}Error: Service $SERVICE not found in namespace $NAMESPACE${NC}"
            exit 1
        fi
    fi
    
    log "${GREEN}✓ Prerequisites check passed${NC}"
}

# Function to create pre-rollback snapshot
create_snapshot() {
    local service=$1
    log "${BLUE}Creating pre-rollback snapshot for $service...${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "${YELLOW}[DRY RUN] Would create snapshot for $service${NC}"
        return 0
    fi
    
    # Get current deployment state
    kubectl get deployment "$service" -n "$NAMESPACE" -o yaml > "snapshot_${service}_$(date +%Y%m%d_%H%M%S).yaml"
    
    # Get current replica count
    CURRENT_REPLICAS=$(kubectl get deployment "$service" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
    echo "$CURRENT_REPLICAS" > "replicas_${service}.txt"
    
    log "${GREEN}✓ Snapshot created for $service${NC}"
}

# Function to rollback Kubernetes deployment
rollback_deployment() {
    local service=$1
    local version=$2
    
    log "${BLUE}Rolling back $service to version $version...${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "${YELLOW}[DRY RUN] Would rollback $service to $version${NC}"
        return 0
    fi
    
    # Scale down to ensure clean state
    kubectl scale deployment "$service" --replicas=0 -n "$NAMESPACE"
    sleep 5
    
    # Update image
    kubectl set image deployment/"$service" "$service=medcontracthub/$service:$version" -n "$NAMESPACE"
    
    # Scale back up
    local replicas=$(cat "replicas_${service}.txt" 2>/dev/null || echo "1")
    kubectl scale deployment "$service" --replicas="$replicas" -n "$NAMESPACE"
    
    # Wait for rollout
    kubectl rollout status deployment/"$service" -n "$NAMESPACE" --timeout=300s
    
    log "${GREEN}✓ Deployment rolled back successfully${NC}"
}

# Function to rollback Kafka consumer offsets
rollback_kafka_offsets() {
    local service=$1
    local timestamp=$2
    
    log "${BLUE}Rolling back Kafka offsets for $service...${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "${YELLOW}[DRY RUN] Would rollback Kafka offsets for $service to $timestamp${NC}"
        return 0
    fi
    
    # Get consumer group for service
    local consumer_group=""
    case $service in
        "ocr-service")
            consumer_group="ocr-service-consumer"
            ;;
        "analytics-service")
            consumer_group="analytics-consumer-group"
            ;;
        "ai-service")
            consumer_group="ai-service-consumer"
            ;;
        *)
            log "${YELLOW}No Kafka consumer group for $service, skipping...${NC}"
            return 0
            ;;
    esac
    
    # Stop consumer first
    kubectl scale deployment "$service" --replicas=0 -n "$NAMESPACE"
    sleep 10
    
    # Reset offsets
    kubectl exec -it kafka-0 -n "$KAFKA_NAMESPACE" -- kafka-consumer-groups.sh \
        --bootstrap-server kafka:9092 \
        --group "$consumer_group" \
        --reset-offsets \
        --to-datetime "$timestamp" \
        --execute \
        --all-topics
    
    log "${GREEN}✓ Kafka offsets rolled back${NC}"
}

# Function to restore ClickHouse data
rollback_clickhouse() {
    local backup_id=$1
    
    log "${BLUE}Restoring ClickHouse from backup $backup_id...${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "${YELLOW}[DRY RUN] Would restore ClickHouse from backup $backup_id${NC}"
        return 0
    fi
    
    # Find ClickHouse pod
    local clickhouse_pod=$(kubectl get pods -n "$NAMESPACE" -l app=clickhouse -o jsonpath='{.items[0].metadata.name}')
    
    if [[ -z "$clickhouse_pod" ]]; then
        log "${RED}Error: ClickHouse pod not found${NC}"
        return 1
    fi
    
    # List tables to restore
    local tables=(
        "opportunity_events"
        "api_usage_events"
        "user_activity_events"
        "proposal_events"
    )
    
    for table in "${tables[@]}"; do
        log "Restoring table $table..."
        
        # Drop existing table
        kubectl exec -it "$clickhouse_pod" -n "$NAMESPACE" -- clickhouse-client \
            --query "DROP TABLE IF EXISTS medcontracthub.$table"
        
        # Restore from backup
        kubectl exec -it "$clickhouse_pod" -n "$NAMESPACE" -- clickhouse-client \
            --query "ATTACH TABLE medcontracthub.$table FROM '$BACKUP_DIR/$backup_id/$table/'"
    done
    
    log "${GREEN}✓ ClickHouse data restored${NC}"
}

# Function to restore Weaviate data
rollback_weaviate() {
    local backup_id=$1
    
    log "${BLUE}Restoring Weaviate from backup $backup_id...${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "${YELLOW}[DRY RUN] Would restore Weaviate from backup $backup_id${NC}"
        return 0
    fi
    
    # Scale down AI service
    kubectl scale deployment ai-service --replicas=0 -n "$NAMESPACE"
    
    # Restore Weaviate backup
    kubectl exec -it weaviate-0 -n "$NAMESPACE" -- /bin/sh -c "
        weaviate-backup restore \
            --backup-id $backup_id \
            --backend filesystem \
            --path $BACKUP_DIR
    "
    
    log "${GREEN}✓ Weaviate data restored${NC}"
}

# Function to validate service health
validate_service() {
    local service=$1
    
    log "${BLUE}Validating $service health...${NC}"
    
    # Wait for pod to be ready
    kubectl wait --for=condition=ready pod -l app="$service" -n "$NAMESPACE" --timeout=120s
    
    # Check health endpoint
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app="$service" -o jsonpath='{.items[0].metadata.name}')
    local health_status=$(kubectl exec "$pod" -n "$NAMESPACE" -- curl -s localhost:8080/health | jq -r '.status' 2>/dev/null || echo "unknown")
    
    if [[ "$health_status" == "healthy" ]] || [[ "$health_status" == "ok" ]]; then
        log "${GREEN}✓ $service is healthy${NC}"
        return 0
    else
        log "${RED}✗ $service health check failed: $health_status${NC}"
        return 1
    fi
}

# Function to rollback individual service
rollback_service() {
    local service=$1
    local version=$2
    
    log "${BLUE}Starting rollback of $service to version $version${NC}"
    
    # Create snapshot
    create_snapshot "$service"
    
    # Service-specific rollback procedures
    case $service in
        "ocr-service")
            rollback_deployment "$service" "$version"
            if [[ -n "$ROLLBACK_TIMESTAMP" ]]; then
                rollback_kafka_offsets "$service" "$ROLLBACK_TIMESTAMP"
            fi
            ;;
            
        "ai-service")
            rollback_deployment "$service" "$version"
            if [[ -n "$BACKUP_ID" ]]; then
                rollback_weaviate "$BACKUP_ID"
            fi
            if [[ -n "$ROLLBACK_TIMESTAMP" ]]; then
                rollback_kafka_offsets "$service" "$ROLLBACK_TIMESTAMP"
            fi
            ;;
            
        "analytics-service")
            rollback_deployment "$service" "$version"
            if [[ -n "$BACKUP_ID" ]]; then
                rollback_clickhouse "$BACKUP_ID"
            fi
            if [[ -n "$ROLLBACK_TIMESTAMP" ]]; then
                rollback_kafka_offsets "$service" "$ROLLBACK_TIMESTAMP"
            fi
            ;;
            
        "realtime-service"|"worker-service")
            rollback_deployment "$service" "$version"
            ;;
            
        "api-gateway")
            # Special handling for Kong
            rollback_deployment "kong-gateway" "$version"
            # Reload Kong configuration
            kubectl exec -it kong-gateway-0 -n "$NAMESPACE" -- kong reload
            ;;
            
        *)
            log "${RED}Unknown service: $service${NC}"
            exit 1
            ;;
    esac
    
    # Validate service health
    sleep 10
    if ! validate_service "$service"; then
        log "${RED}Service validation failed. Manual intervention may be required.${NC}"
        exit 1
    fi
    
    log "${GREEN}✓ Rollback of $service completed successfully${NC}"
}

# Function to rollback all services
rollback_all() {
    local version=$1
    
    log "${BLUE}Starting full system rollback to version $version${NC}"
    
    # Define rollback order (reverse of startup order)
    local services=(
        "realtime-service"
        "worker-service"
        "ai-service"
        "analytics-service"
        "ocr-service"
        "api-gateway"
    )
    
    for service in "${services[@]}"; do
        log "${BLUE}Rolling back $service...${NC}"
        rollback_service "$service" "$version"
    done
    
    log "${GREEN}✓ Full system rollback completed${NC}"
}

# Function to generate rollback report
generate_report() {
    log "${BLUE}Generating rollback report...${NC}"
    
    cat << EOF > "rollback_report_$(date +%Y%m%d_%H%M%S).txt"
Rollback Report
===============
Date: $(date)
Service: $SERVICE
Target Version: $VERSION
Rollback Timestamp: ${ROLLBACK_TIMESTAMP:-N/A}
Backup ID: ${BACKUP_ID:-N/A}
Dry Run: $DRY_RUN

Service Status After Rollback:
EOF

    kubectl get deployments -n "$NAMESPACE" >> "rollback_report_$(date +%Y%m%d_%H%M%S).txt"
    
    log "${GREEN}✓ Report generated${NC}"
}

# Main execution
main() {
    log "${BLUE}=== MedContractHub Microservices Rollback ===${NC}"
    log "Service: $SERVICE"
    log "Version: $VERSION"
    log "Timestamp: $(date)"
    
    # Confirm action
    confirm
    
    # Check prerequisites
    check_prerequisites
    
    # Execute rollback
    if [[ "$SERVICE" == "all" ]]; then
        rollback_all "$VERSION"
    else
        rollback_service "$SERVICE" "$VERSION"
    fi
    
    # Generate report
    generate_report
    
    log "${GREEN}✅ Rollback completed successfully!${NC}"
    log "Log file: $LOG_FILE"
}

# Run main function
main