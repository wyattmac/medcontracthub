#!/bin/bash

# Docker Logs Helper Script for WSL
# This script ensures Docker commands work properly in WSL environment

# Set Docker host for WSL
export DOCKER_HOST=unix:///var/run/docker.sock

echo "🐳 MedContractHub Docker Logs Viewer"
echo "===================================="
echo ""

# Check if Docker is running
if ! docker ps >/dev/null 2>&1; then
    echo "❌ Docker is not running or not accessible"
    echo "   Please ensure Docker Desktop is running"
    exit 1
fi

# Show available containers
echo "📦 Available containers:"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Function to show logs for a specific service
show_logs() {
    local service=$1
    local lines=${2:-50}
    
    echo "📋 Logs for $service (last $lines lines):"
    echo "----------------------------------------"
    docker-compose logs --tail=$lines $service
    echo ""
}

# Main menu
if [ $# -eq 0 ]; then
    echo "Usage: ./docker-logs.sh [service] [options]"
    echo ""
    echo "Services:"
    echo "  app       - Next.js application"
    echo "  postgres  - PostgreSQL database"
    echo "  redis     - Redis cache"
    echo "  all       - All services"
    echo "  follow    - Follow all logs (live)"
    echo ""
    echo "Examples:"
    echo "  ./docker-logs.sh app          # Show last 50 lines of app logs"
    echo "  ./docker-logs.sh app 100      # Show last 100 lines of app logs"
    echo "  ./docker-logs.sh follow       # Follow all logs in real-time"
    echo "  ./docker-logs.sh all          # Show all service logs"
elif [ "$1" = "follow" ]; then
    echo "📡 Following all logs (Ctrl+C to stop)..."
    docker-compose logs -f
elif [ "$1" = "all" ]; then
    show_logs "app" 50
    show_logs "postgres" 20
    show_logs "redis" 20
else
    show_logs "$1" "${2:-50}"
fi

# Show helpful commands
echo ""
echo "💡 Helpful Docker commands:"
echo "  docker-compose ps                    # Check container status"
echo "  docker-compose logs -f app           # Follow app logs"
echo "  docker-compose restart app           # Restart app container"
echo "  docker-compose exec app sh           # Open shell in app container"