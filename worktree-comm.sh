#!/bin/bash

# Worktree Communication Script
# Used for inter-worktree messaging in MedContractHub

WORKTREE_NAME=$(basename $(pwd) | sed 's/medcontracthub-//')
COMMS_DIR=".claude/comms"

# Create comms directory if it doesn't exist
mkdir -p "$COMMS_DIR"

# Function to send a message
send_message() {
    local to="$1"
    local message="$2"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    
    echo "[$timestamp] FROM: $WORKTREE_NAME TO: $to" >> "$COMMS_DIR/MESSAGES.md"
    echo "$message" >> "$COMMS_DIR/MESSAGES.md"
    echo "---" >> "$COMMS_DIR/MESSAGES.md"
    echo "Message sent to $to"
}

# Function to post status
post_status() {
    local status="$1"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    
    echo "[$timestamp] $WORKTREE_NAME: $status" >> "$COMMS_DIR/STATUS-$WORKTREE_NAME.md"
    echo "Status posted"
}

# Function to create alert
create_alert() {
    local alert="$1"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    
    echo "🚨 [$timestamp] ALERT from $WORKTREE_NAME: $alert" >> "$COMMS_DIR/ALERTS.md"
    echo "Alert created"
}

# Main command handler
case "$1" in
    send)
        send_message "$2" "$3"
        ;;
    status)
        post_status "$2"
        ;;
    alert)
        create_alert "$2"
        ;;
    *)
        echo "Usage: $0 {send|status|alert} [arguments]"
        echo "  send <to> <message>  - Send message to another worktree"
        echo "  status <message>     - Post status update"
        echo "  alert <message>      - Create an alert for all worktrees"
        exit 1
        ;;
esac