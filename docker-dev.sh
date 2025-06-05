#!/bin/bash

# Docker development helper script for MedContractHub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

# Function to check if Docker is running
check_docker() {
    if ! docker ps > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

# Function to build development image
build_dev() {
    log "Building development Docker image..."
    docker-compose build app
    success "Development image built successfully"
}

# Function to start development environment
start_dev() {
    log "Starting development environment..."
    docker-compose up -d
    
    log "Waiting for services to be healthy..."
    sleep 10
    
    # Check if app is healthy
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        success "Development environment is running!"
        echo ""
        echo "🚀 Application: http://localhost:3000"
        echo "📊 Bull Dashboard: http://localhost:3001"
        echo "🗄️  PostgreSQL: localhost:5432"
        echo "🔴 Redis: localhost:6379"
        echo ""
        echo "To view logs: docker-compose logs -f"
        echo "To stop: docker-compose down"
    else
        warn "Application might still be starting up. Check logs with: docker-compose logs -f app"
    fi
}

# Function to stop development environment
stop_dev() {
    log "Stopping development environment..."
    docker-compose down
    success "Development environment stopped"
}

# Function to view logs
logs() {
    docker-compose logs -f "${1:-app}"
}

# Function to build production image
build_prod() {
    log "Building production Docker image..."
    docker build -t medcontracthub:latest .
    success "Production image built successfully"
}

# Function to start production environment
start_prod() {
    log "Starting production environment..."
    docker-compose -f docker-compose.prod.yml up -d
    
    log "Waiting for services to be healthy..."
    sleep 15
    
    # Check if app is healthy
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        success "Production environment is running!"
        echo ""
        echo "🚀 Application: http://localhost:3000"
        echo "🌐 Nginx: http://localhost:80"
        echo "🔴 Redis: localhost:6379"
        echo ""
        echo "To view logs: docker-compose -f docker-compose.prod.yml logs -f"
        echo "To stop: docker-compose -f docker-compose.prod.yml down"
    else
        warn "Application might still be starting up. Check logs with: docker-compose -f docker-compose.prod.yml logs -f app"
    fi
}

# Function to stop production environment
stop_prod() {
    log "Stopping production environment..."
    docker-compose -f docker-compose.prod.yml down
    success "Production environment stopped"
}

# Function to clean up Docker resources
cleanup() {
    log "Cleaning up Docker resources..."
    docker-compose down
    docker-compose -f docker-compose.prod.yml down
    docker system prune -f
    docker volume prune -f
    success "Cleanup completed"
}

# Function to show help
show_help() {
    echo "MedContractHub Docker Development Helper"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  build-dev     Build development Docker image"
    echo "  start-dev     Start development environment with hot-reload"
    echo "  stop-dev      Stop development environment"
    echo "  logs [service] View logs for a service (default: app)"
    echo ""
    echo "  build-prod    Build production Docker image"
    echo "  start-prod    Start production environment"
    echo "  stop-prod     Stop production environment"
    echo ""
    echo "  cleanup       Clean up all Docker resources"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start-dev     # Start development with hot-reload"
    echo "  $0 logs app      # View app logs"
    echo "  $0 start-prod    # Start production environment"
}

# Main script logic
case "${1:-help}" in
    build-dev)
        check_docker
        build_dev
        ;;
    start-dev)
        check_docker
        start_dev
        ;;
    stop-dev)
        check_docker
        stop_dev
        ;;
    logs)
        check_docker
        logs "$2"
        ;;
    build-prod)
        check_docker
        build_prod
        ;;
    start-prod)
        check_docker
        start_prod
        ;;
    stop-prod)
        check_docker
        stop_prod
        ;;
    cleanup)
        check_docker
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac