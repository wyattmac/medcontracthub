#!/bin/bash

# Automated Backup Script for MedContractHub
# Can be run as a cron job for regular backups

set -e

# Configuration
BACKUP_DIR="/app/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    error "Docker is not running"
    exit 1
fi

# Backup function
backup_database() {
    local env=$1
    local db_name=$2
    local container_name=$3
    
    log "Starting backup for $env environment..."
    
    if docker ps | grep -q "$container_name"; then
        local backup_file="$BACKUP_DIR/${env}_backup_${TIMESTAMP}.sql"
        
        if docker exec "$container_name" pg_dump -U postgres "$db_name" > "$backup_file"; then
            # Compress the backup
            gzip "$backup_file"
            success "Backup completed: ${backup_file}.gz"
            
            # Verify backup integrity
            if gunzip -t "${backup_file}.gz"; then
                success "Backup integrity verified"
            else
                error "Backup integrity check failed"
                return 1
            fi
        else
            error "Failed to create backup for $env"
            return 1
        fi
    else
        warning "$container_name is not running, skipping backup"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    if find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete; then
        success "Old backups cleaned up"
    else
        warning "Failed to clean up old backups"
    fi
}

# Main backup process
main() {
    log "Starting automated backup process..."
    
    # Backup development database
    backup_database "dev" "medcontracthub_dev" "medcontract-dev-db"
    
    # Backup staging database
    backup_database "staging" "medcontracthub_staging" "medcontract-staging-db"
    
    # Note: Production database backup should use Supabase's backup system
    log "Production database should be backed up using Supabase dashboard"
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Create backup report
    create_backup_report
    
    success "Automated backup process completed"
}

# Create backup report
create_backup_report() {
    local report_file="$BACKUP_DIR/backup_report_${TIMESTAMP}.txt"
    
    cat > "$report_file" << EOF
MedContractHub Backup Report
Generated: $(date)
================================

Backup Files Created:
$(ls -la "$BACKUP_DIR"/*_backup_${TIMESTAMP}.sql.gz 2>/dev/null || echo "No backups created")

Disk Usage:
$(du -sh "$BACKUP_DIR")

Recent Backups:
$(ls -lt "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -10 || echo "No backup files found")

System Information:
- Docker Status: $(docker ps --format 'table {{.Names}}\t{{.Status}}' | grep medcontract || echo "No containers running")
- Backup Directory: $BACKUP_DIR
- Retention Policy: $RETENTION_DAYS days

EOF

    log "Backup report created: $report_file"
}

# Handle script termination
cleanup() {
    log "Backup script interrupted, cleaning up..."
    exit 1
}

trap cleanup INT TERM

# Run main function
main

# Optional: Send notification (uncomment if you have notification system)
# notify_completion() {
#     curl -X POST "https://api.slack.com/services/..." \
#         -H "Content-type: application/json" \
#         --data "{\"text\":\"MedContractHub backup completed successfully at $(date)\"}"
# }
# notify_completion