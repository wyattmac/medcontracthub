#!/bin/bash

# Docker Multi-Environment Management Scripts
# Usage: ./docker-scripts.sh [command] [environment]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo -e "${BLUE}Docker Multi-Environment Management${NC}"
    echo ""
    echo "Usage: $0 [command] [environment]"
    echo ""
    echo "Commands:"
    echo "  start       Start an environment"
    echo "  stop        Stop an environment"
    echo "  restart     Restart an environment"
    echo "  logs        View logs for an environment"
    echo "  shell       Open shell in app container"
    echo "  build       Build images for an environment"
    echo "  clean       Clean up an environment"
    echo "  status      Check status of all environments"
    echo "  migrate     Run database migrations"
    echo "  backup      Backup database"
    echo ""
    echo "Environments:"
    echo "  dev         Development environment (port 3000)"
    echo "  staging     Staging environment (port 3001)"
    echo "  prod        Production environment (port 3002)"
    echo "  all         All environments (for stop/status commands)"
    echo ""
    echo "Examples:"
    echo "  $0 start dev"
    echo "  $0 logs staging"
    echo "  $0 shell prod"
    echo "  $0 status all"
}

# Check if docker-compose is installed
check_docker() {
    # Try native docker-compose first, then Windows executable
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif command -v docker-compose.exe &> /dev/null; then
        DOCKER_COMPOSE="docker-compose.exe"
    else
        echo -e "${RED}Error: docker-compose is not installed${NC}"
        echo -e "${YELLOW}Please enable Docker Desktop WSL integration${NC}"
        echo "See DOCKER_WSL_SETUP.md for instructions"
        exit 1
    fi
    
    # Check Docker daemon is running
    if ! $DOCKER_COMPOSE version &> /dev/null; then
        echo -e "${RED}Error: Cannot connect to Docker daemon${NC}"
        echo -e "${YELLOW}Is Docker Desktop running?${NC}"
        exit 1
    fi
}

# Start environment
start_env() {
    local env=$1
    echo -e "${BLUE}Starting $env environment...${NC}"
    
    case $env in
        dev)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml up -d dev-app dev-redis dev-db
            echo -e "${GREEN}Development environment started at http://localhost:3000${NC}"
            ;;
        staging)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml up -d staging-app staging-redis staging-db
            echo -e "${GREEN}Staging environment started at http://localhost:3001${NC}"
            ;;
        prod)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml up -d prod-app prod-redis
            echo -e "${GREEN}Production environment started at http://localhost:3002${NC}"
            ;;
        all)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml up -d
            echo -e "${GREEN}All environments started${NC}"
            echo "  Dev: http://localhost:3000"
            echo "  Staging: http://localhost:3001"
            echo "  Prod: http://localhost:3002"
            ;;
        *)
            echo -e "${RED}Invalid environment: $env${NC}"
            usage
            exit 1
            ;;
    esac
}

# Stop environment
stop_env() {
    local env=$1
    echo -e "${BLUE}Stopping $env environment...${NC}"
    
    case $env in
        dev)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml stop dev-app dev-redis dev-db
            ;;
        staging)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml stop staging-app staging-redis staging-db
            ;;
        prod)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml stop prod-app prod-redis
            ;;
        all)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml stop
            ;;
        *)
            echo -e "${RED}Invalid environment: $env${NC}"
            usage
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}$env environment stopped${NC}"
}

# View logs
view_logs() {
    local env=$1
    echo -e "${BLUE}Viewing logs for $env environment...${NC}"
    
    case $env in
        dev)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml logs -f dev-app
            ;;
        staging)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml logs -f staging-app
            ;;
        prod)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml logs -f prod-app
            ;;
        *)
            echo -e "${RED}Invalid environment: $env${NC}"
            usage
            exit 1
            ;;
    esac
}

# Open shell
open_shell() {
    local env=$1
    echo -e "${BLUE}Opening shell in $env environment...${NC}"
    
    case $env in
        dev)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml exec dev-app sh
            ;;
        staging)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml exec staging-app sh
            ;;
        prod)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml exec prod-app sh
            ;;
        *)
            echo -e "${RED}Invalid environment: $env${NC}"
            usage
            exit 1
            ;;
    esac
}

# Build images
build_env() {
    local env=$1
    echo -e "${BLUE}Building $env environment...${NC}"
    
    case $env in
        dev)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml build dev-app
            ;;
        staging)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml build staging-app
            ;;
        prod)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml build prod-app
            ;;
        all)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml build
            ;;
        *)
            echo -e "${RED}Invalid environment: $env${NC}"
            usage
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}Build completed for $env${NC}"
}

# Check status
check_status() {
    echo -e "${BLUE}Environment Status:${NC}"
    echo ""
    $DOCKER_COMPOSE -f docker-compose.multi-env.yml ps
}

# Clean environment
clean_env() {
    local env=$1
    echo -e "${YELLOW}Warning: This will remove containers and volumes for $env${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        case $env in
            dev)
                $DOCKER_COMPOSE -f docker-compose.multi-env.yml down -v dev-app dev-redis dev-db
                ;;
            staging)
                $DOCKER_COMPOSE -f docker-compose.multi-env.yml down -v staging-app staging-redis staging-db
                ;;
            prod)
                $DOCKER_COMPOSE -f docker-compose.multi-env.yml down -v prod-app prod-redis
                ;;
            all)
                $DOCKER_COMPOSE -f docker-compose.multi-env.yml down -v
                ;;
            *)
                echo -e "${RED}Invalid environment: $env${NC}"
                usage
                exit 1
                ;;
        esac
        echo -e "${GREEN}$env environment cleaned${NC}"
    else
        echo -e "${YELLOW}Cancelled${NC}"
    fi
}

# Run migrations
run_migrations() {
    local env=$1
    echo -e "${BLUE}Running migrations for $env environment...${NC}"
    
    case $env in
        dev)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml exec dev-app npm run migrate
            ;;
        staging)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml exec staging-app npm run migrate
            ;;
        prod)
            echo -e "${YELLOW}Production migrations should be run carefully!${NC}"
            read -p "Are you sure? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                $DOCKER_COMPOSE -f docker-compose.multi-env.yml exec prod-app npm run migrate
            fi
            ;;
        *)
            echo -e "${RED}Invalid environment: $env${NC}"
            usage
            exit 1
            ;;
    esac
}

# Backup database
backup_db() {
    local env=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="./backups"
    
    mkdir -p $backup_dir
    
    echo -e "${BLUE}Backing up $env database...${NC}"
    
    case $env in
        dev)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml exec -T dev-db pg_dump -U postgres medcontracthub_dev > "$backup_dir/dev_backup_$timestamp.sql"
            ;;
        staging)
            $DOCKER_COMPOSE -f docker-compose.multi-env.yml exec -T staging-db pg_dump -U postgres medcontracthub_staging > "$backup_dir/staging_backup_$timestamp.sql"
            ;;
        prod)
            echo -e "${YELLOW}Backing up production database...${NC}"
            # For production, you might want to use Supabase's backup instead
            echo -e "${YELLOW}Note: Consider using Supabase dashboard for production backups${NC}"
            ;;
        *)
            echo -e "${RED}Invalid environment: $env${NC}"
            usage
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}Backup saved to $backup_dir${NC}"
}

# Main script
check_docker

if [ $# -lt 2 ]; then
    usage
    exit 1
fi

command=$1
environment=$2

case $command in
    start)
        start_env $environment
        ;;
    stop)
        stop_env $environment
        ;;
    restart)
        stop_env $environment
        start_env $environment
        ;;
    logs)
        view_logs $environment
        ;;
    shell)
        open_shell $environment
        ;;
    build)
        build_env $environment
        ;;
    clean)
        clean_env $environment
        ;;
    status)
        check_status
        ;;
    migrate)
        run_migrations $environment
        ;;
    backup)
        backup_db $environment
        ;;
    *)
        echo -e "${RED}Invalid command: $command${NC}"
        usage
        exit 1
        ;;
esac