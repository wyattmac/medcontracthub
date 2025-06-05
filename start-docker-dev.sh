#!/bin/bash

# Quick start script for Docker development environment

echo "🚀 Starting MedContractHub Docker Development Environment..."
echo ""

# Check if we need to copy env file
if [ ! -f .env ]; then
    echo "📋 Creating .env file from template..."
    cp .env.docker.example .env
    echo "⚠️  Please edit .env with your actual API keys"
    echo ""
fi

# Try to start with docker-compose directly
echo "🐳 Starting containers..."
docker-compose -f docker-compose.multi-env.yml up -d dev-app dev-redis dev-db

# Check if successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Development environment started successfully!"
    echo "🌐 Access your app at: http://localhost:3000"
    echo ""
    echo "📝 Useful commands:"
    echo "  View logs:    docker-compose -f docker-compose.multi-env.yml logs -f dev-app"
    echo "  Stop:         docker-compose -f docker-compose.multi-env.yml stop dev-app dev-redis dev-db"
    echo "  Shell access: docker-compose -f docker-compose.multi-env.yml exec dev-app sh"
else
    echo ""
    echo "❌ Failed to start containers"
    echo ""
    echo "🔧 Try these fixes:"
    echo "1. Run: newgrp docker"
    echo "2. Or log out and log back in to WSL"
    echo "3. Or prefix commands with sudo (not recommended)"
fi