#!/bin/bash

# Backup and Restore Script for MedContractHub Kubernetes Deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE="${NAMESPACE:-medcontracthub}"

# Function to display usage
usage() {
    echo -e "${BLUE}MedContractHub Backup & Restore Utility${NC}"
    echo -e "${BLUE}=======================================${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  backup postgres      - Manually trigger PostgreSQL backup"
    echo "  backup weaviate      - Manually trigger Weaviate backup"
    echo "  backup clickhouse    - Manually trigger ClickHouse backup"
    echo "  backup all           - Backup all databases"
    echo "  list                 - List available backups"
    echo "  restore postgres <backup-file> - Restore PostgreSQL from backup"
    echo "  schedule             - Show backup schedule"
    echo "  test                 - Test backup system"
    echo ""
    exit 1
}

# Trigger PostgreSQL backup
backup_postgres() {
    echo -e "${YELLOW}Triggering PostgreSQL backup...${NC}"
    
    # Create a one-time job from the CronJob template
    kubectl create job postgres-backup-manual-$(date +%s) \
        --from=cronjob/postgres-backup \
        -n $NAMESPACE
    
    echo -e "${GREEN}✓ PostgreSQL backup job created${NC}"
    echo "Monitor progress with: kubectl logs -f -l job-name=postgres-backup-manual-* -n $NAMESPACE"
}

# Trigger Weaviate backup
backup_weaviate() {
    echo -e "${YELLOW}Triggering Weaviate backup...${NC}"
    
    kubectl create job weaviate-backup-manual-$(date +%s) \
        --from=cronjob/weaviate-backup \
        -n $NAMESPACE
    
    echo -e "${GREEN}✓ Weaviate backup job created${NC}"
}

# Trigger ClickHouse backup
backup_clickhouse() {
    echo -e "${YELLOW}Triggering ClickHouse backup...${NC}"
    
    kubectl create job clickhouse-backup-manual-$(date +%s) \
        --from=cronjob/clickhouse-backup \
        -n $NAMESPACE
    
    echo -e "${GREEN}✓ ClickHouse backup job created${NC}"
}

# Backup all databases
backup_all() {
    echo -e "${YELLOW}Backing up all databases...${NC}"
    backup_postgres
    backup_weaviate
    backup_clickhouse
    echo -e "${GREEN}✓ All backup jobs created${NC}"
}

# List available backups
list_backups() {
    echo -e "${BLUE}Available Backups${NC}"
    echo -e "${BLUE}=================${NC}"
    
    # Get a pod that has access to the backup volume
    BACKUP_POD=$(kubectl get pods -n $NAMESPACE -l component=backup -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$BACKUP_POD" ]; then
        echo -e "${YELLOW}Creating temporary pod to list backups...${NC}"
        kubectl run backup-list-temp --rm -i --restart=Never \
            --image=busybox \
            --overrides='{
                "spec": {
                    "volumes": [{
                        "name": "backup-storage",
                        "persistentVolumeClaim": {
                            "claimName": "backup-storage-pvc"
                        }
                    }],
                    "containers": [{
                        "name": "backup-list",
                        "image": "busybox",
                        "command": ["ls", "-la", "/backups"],
                        "volumeMounts": [{
                            "name": "backup-storage",
                            "mountPath": "/backups"
                        }]
                    }]
                }
            }' -n $NAMESPACE
    else
        kubectl exec $BACKUP_POD -n $NAMESPACE -- ls -la /backups/
    fi
}

# Restore PostgreSQL from backup
restore_postgres() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        echo -e "${RED}Error: Backup file not specified${NC}"
        echo "Usage: $0 restore postgres <backup-file>"
        list_backups
        exit 1
    fi
    
    echo -e "${YELLOW}⚠️  WARNING: This will restore the PostgreSQL database${NC}"
    echo -e "${YELLOW}   Current data will be overwritten!${NC}"
    echo -n "Are you sure you want to continue? [y/N] "
    read -r response
    
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Restore cancelled"
        exit 0
    fi
    
    echo -e "${YELLOW}Restoring PostgreSQL from: $backup_file${NC}"
    
    # Create restore job with the specified backup file
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: postgres-restore-$(date +%s)
  namespace: $NAMESPACE
spec:
  template:
    spec:
      restartPolicy: Never
      serviceAccountName: backup-operator
      containers:
      - name: postgres-restore
        image: postgres:15-alpine
        command: ["/bin/sh", "-c"]
        args:
        - |
          set -e
          echo "Restoring from: $backup_file"
          gunzip -c /backups/$backup_file | PGPASSWORD=\$POSTGRES_PASSWORD psql \
            -h postgres-primary \
            -U postgres \
            -d medcontracthub \
            -v ON_ERROR_STOP=1
          echo "Restore completed successfully"
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-primary-secrets
              key: password
        - name: BACKUP_FILE
          value: "$backup_file"
        volumeMounts:
        - name: backup-storage
          mountPath: /backups
      volumes:
      - name: backup-storage
        persistentVolumeClaim:
          claimName: backup-storage-pvc
EOF
    
    echo -e "${GREEN}✓ Restore job created${NC}"
    echo "Monitor progress with: kubectl logs -f -l job-name=postgres-restore-* -n $NAMESPACE"
}

# Show backup schedule
show_schedule() {
    echo -e "${BLUE}Backup Schedule${NC}"
    echo -e "${BLUE}===============${NC}"
    echo ""
    
    echo "CronJob schedules:"
    kubectl get cronjobs -n $NAMESPACE | grep backup || echo "No backup jobs found"
    echo ""
    
    echo "Schedule details:"
    echo "  PostgreSQL: Daily at 2:00 AM"
    echo "  Weaviate:   Daily at 3:00 AM"
    echo "  ClickHouse: Daily at 4:00 AM"
    echo ""
    
    echo "Recent backup jobs:"
    kubectl get jobs -n $NAMESPACE | grep backup | head -10
}

# Test backup system
test_backup() {
    echo -e "${BLUE}Testing Backup System${NC}"
    echo -e "${BLUE}====================${NC}"
    echo ""
    
    # Check if backup PVC exists
    echo -n "Checking backup storage... "
    if kubectl get pvc backup-storage-pvc -n $NAMESPACE &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        SIZE=$(kubectl get pvc backup-storage-pvc -n $NAMESPACE -o jsonpath='{.status.capacity.storage}')
        USED=$(kubectl get pvc backup-storage-pvc -n $NAMESPACE -o jsonpath='{.status.used}' 2>/dev/null || echo "unknown")
        echo "  Storage: $SIZE (Used: $USED)"
    else
        echo -e "${RED}✗ PVC not found${NC}"
    fi
    
    # Check if service account exists
    echo -n "Checking backup service account... "
    if kubectl get sa backup-operator -n $NAMESPACE &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ Not found${NC}"
    fi
    
    # Check if CronJobs exist
    echo ""
    echo "Checking backup jobs:"
    for job in postgres-backup weaviate-backup clickhouse-backup; do
        echo -n "  $job... "
        if kubectl get cronjob $job -n $NAMESPACE &> /dev/null; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗ Not found${NC}"
        fi
    done
    
    echo ""
    echo -e "${BLUE}Test complete${NC}"
}

# Main execution
case "${1:-}" in
    backup)
        case "${2:-}" in
            postgres)
                backup_postgres
                ;;
            weaviate)
                backup_weaviate
                ;;
            clickhouse)
                backup_clickhouse
                ;;
            all)
                backup_all
                ;;
            *)
                usage
                ;;
        esac
        ;;
    list)
        list_backups
        ;;
    restore)
        case "${2:-}" in
            postgres)
                restore_postgres "$3"
                ;;
            *)
                echo -e "${RED}Error: Only PostgreSQL restore is currently implemented${NC}"
                exit 1
                ;;
        esac
        ;;
    schedule)
        show_schedule
        ;;
    test)
        test_backup
        ;;
    *)
        usage
        ;;
esac