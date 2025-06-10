#!/bin/bash

# Docker Management Script for WSL
# Consolidated three-stage Docker environment management

# Set Docker host for WSL
export DOCKER_HOST=unix:///var/run/docker.sock

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo -e "${BLUE}🐳 MedContractHub Docker Manager${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    echo "Usage: ./docker-manage.sh [command] [environment]"
    echo ""
    echo "Commands:"
    echo "  start     - Start services"
    echo "  stop      - Stop services"
    echo "  restart   - Restart services"
    echo "  logs      - View logs"
    echo "  status    - Check status"
    echo "  clean     - Clean up containers and volumes"
    echo ""
    echo "Environments:"
    echo "  dev       - Development (port 3000)"
    echo "  staging   - Staging (port 3001)"
    echo "  prod      - Production (port 80/443)"
    echo ""
    echo "Examples:"
    echo "  ./docker-manage.sh start dev"
    echo "  ./docker-manage.sh logs staging"
    echo "  ./docker-manage.sh status prod"
}

# Function to check Docker
check_docker() {
    if ! docker ps >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running or not accessible${NC}"
        echo "   Please ensure Docker Desktop is running"
        exit 1
    fi
}

# Function to get compose file for environment
get_compose_file() {
    case $1 in
        dev|development)
            echo "docker-compose.development.yml"
            ;;
        staging)
            echo "docker-compose.staging.yml"
            ;;
        prod|production)
            echo "docker-compose.production.yml"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Function to start services
start_services() {
    local env=$1
    local compose_file=$(get_compose_file $env)
    
    if [ -z "$compose_file" ]; then
        echo -e "${RED}❌ Invalid environment: $env${NC}"
        show_usage
        exit 1
    fi
    
    echo -e "${BLUE}🚀 Starting $env environment...${NC}"
    
    # Use only environment-specific config (base is removed due to anchor issues)
    docker-compose -f $compose_file up -d --build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $env environment started successfully!${NC}"
        echo ""
        case $env in
            dev|development)
                echo "📱 Access your app at: http://localhost:3000"
                echo "📊 Bull Dashboard at: http://localhost:3003"
                ;;
            staging)
                echo "📱 Access your app at: http://localhost:3001"
                ;;
            prod|production)
                echo "📱 Access your app at: http://localhost"
                ;;
        esac
    else
        echo -e "${RED}❌ Failed to start $env environment${NC}"
        exit 1
    fi
}

# Function to stop services
stop_services() {
    local env=$1
    local compose_file=$(get_compose_file $env)
    
    if [ -z "$compose_file" ]; then
        echo -e "${RED}❌ Invalid environment: $env${NC}"
        show_usage
        exit 1
    fi
    
    echo -e "${BLUE}🛑 Stopping $env environment...${NC}"
    docker-compose -f $compose_file down
    echo -e "${GREEN}✅ $env environment stopped${NC}"
}

# Function to view logs
view_logs() {
    local env=$1
    local compose_file=$(get_compose_file $env)
    
    if [ -z "$compose_file" ]; then
        echo -e "${RED}❌ Invalid environment: $env${NC}"
        show_usage
        exit 1
    fi
    
    echo -e "${BLUE}📋 Showing logs for $env environment...${NC}"
    docker-compose -f $compose_file logs -f
}

# Function to check status
check_status() {
    local env=$1
    local compose_file=$(get_compose_file $env)
    
    if [ -z "$compose_file" ]; then
        echo -e "${RED}❌ Invalid environment: $env${NC}"
        show_usage
        exit 1
    fi
    
    echo -e "${BLUE}📊 Status for $env environment:${NC}"
    docker-compose -f $compose_file ps
}

# Function to clean up
clean_environment() {
    local env=$1
    local compose_file=$(get_compose_file $env)
    
    if [ -z "$compose_file" ]; then
        echo -e "${RED}❌ Invalid environment: $env${NC}"
        show_usage
        exit 1
    fi
    
    echo -e "${YELLOW}⚠️  This will remove containers and volumes for $env environment${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose -f $compose_file down -v
        echo -e "${GREEN}✅ $env environment cleaned${NC}"
    fi
}

# Main script logic
check_docker

if [ $# -lt 2 ]; then
    show_usage
    exit 1
fi

command=$1
environment=$2

case $command in
    start)
        start_services $environment
        ;;
    stop)
        stop_services $environment
        ;;
    restart)
        stop_services $environment
        sleep 2
        start_services $environment
        ;;
    logs)
        view_logs $environment
        ;;
    status)
        check_status $environment
        ;;
    clean)
        clean_environment $environment
        ;;
    *)
        echo -e "${RED}❌ Invalid command: $command${NC}"
        show_usage
        exit 1
        ;;
esac