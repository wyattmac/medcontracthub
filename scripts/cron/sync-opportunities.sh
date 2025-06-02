#!/bin/bash

# Automated SAM.gov Opportunity Sync Script
# This script fetches new opportunities from SAM.gov and syncs them to the database
# Designed to run as a cron job every 6 hours

set -e  # Exit on any error

# Configuration
APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
SYNC_TOKEN="${SYNC_TOKEN:-default-sync-token}"
LOG_FILE="/tmp/medcontracthub-sync.log"
MAX_LOG_SIZE=10485760  # 10MB

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to rotate log file if it gets too large
rotate_log() {
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt $MAX_LOG_SIZE ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
        log "Log file rotated"
    fi
}

# Function to send sync request
sync_opportunities() {
    local limit=${1:-500}
    local force=${2:-false}
    
    log "Starting opportunity sync (limit: $limit, force: $force)"
    
    # Build URL with parameters
    local url="${APP_URL}/api/sync"
    if [ "$force" = "true" ]; then
        url="${url}?force=true"
    fi
    url="${url}&limit=${limit}"
    
    # Make sync request
    local response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $SYNC_TOKEN" \
        -H "Content-Type: application/json" \
        "$url" 2>&1)
    
    # Parse response
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        log "Sync completed successfully"
        log "Response: $body"
        
        # Parse and log stats
        local inserted=$(echo "$body" | grep -o '"inserted":[0-9]*' | cut -d':' -f2 || echo "0")
        local updated=$(echo "$body" | grep -o '"updated":[0-9]*' | cut -d':' -f2 || echo "0")
        local fetched=$(echo "$body" | grep -o '"fetched":[0-9]*' | cut -d':' -f2 || echo "0")
        
        log "Stats - Fetched: $fetched, Inserted: $inserted, Updated: $updated"
    else
        log "Sync failed with HTTP $http_code"
        log "Error response: $body"
        return 1
    fi
}

# Function to check if sync is already running
check_running() {
    local pid_file="/tmp/medcontracthub-sync.pid"
    
    if [ -f "$pid_file" ]; then
        local old_pid=$(cat "$pid_file")
        if ps -p "$old_pid" > /dev/null 2>&1; then
            log "Sync already running (PID: $old_pid), exiting"
            exit 0
        else
            log "Removing stale PID file"
            rm -f "$pid_file"
        fi
    fi
    
    # Create new PID file
    echo $$ > "$pid_file"
    
    # Clean up PID file on exit
    trap "rm -f $pid_file" EXIT
}

# Function to send health check
health_check() {
    log "Performing health check"
    
    local response=$(curl -s -w "\n%{http_code}" \
        "${APP_URL}/api/health" 2>&1)
    
    local http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        log "Health check passed"
        return 0
    else
        log "Health check failed with HTTP $http_code"
        return 1
    fi
}

# Main execution
main() {
    rotate_log
    log "=== Starting MedContractHub Sync ==="
    
    # Check if already running
    check_running
    
    # Parse command line arguments
    local limit=500
    local force=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --limit)
                limit="$2"
                shift 2
                ;;
            --force)
                force=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--limit NUM] [--force] [--help]"
                echo "  --limit NUM  Maximum opportunities to fetch (default: 500)"
                echo "  --force      Force full sync (ignore date filters)"
                echo "  --help       Show this help message"
                exit 0
                ;;
            *)
                log "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Health check
    if ! health_check; then
        log "Health check failed, aborting sync"
        exit 1
    fi
    
    # Perform sync
    if sync_opportunities "$limit" "$force"; then
        log "=== Sync Completed Successfully ==="
        exit 0
    else
        log "=== Sync Failed ==="
        exit 1
    fi
}

# Run main function with all arguments
main "$@"