#!/bin/bash

# Comprehensive Docker Environment Tester
# This script tests all Docker environments automatically

echo "🐳 Docker Environment Complete Test"
echo "=================================="
echo ""

# Function to test an environment
test_environment() {
    local env=$1
    local port=$2
    
    echo "🧪 Testing $env environment..."
    echo "----------------------------"
    
    # Start the environment
    echo "Starting $env..."
    ./docker-scripts.sh start $env
    
    # Wait for startup
    echo "Waiting for services to start..."
    sleep 15
    
    # Test health endpoint
    echo "Testing health endpoint..."
    curl -s http://localhost:$port/api/health || echo "Health check failed"
    echo ""
    
    # Test main page
    echo "Testing main page..."
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:$port
    echo ""
    
    # Check logs for errors
    echo "Checking for errors in logs..."
    docker logs medcontract-$env 2>&1 | grep -i error | tail -3 || echo "No errors found"
    echo ""
    
    # Stop the environment
    echo "Stopping $env..."
    ./docker-scripts.sh stop $env
    echo ""
    echo "✅ $env test complete!"
    echo ""
}

# Test all environments
echo "📋 Current Docker Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Run tests
test_environment "dev" "3000"
test_environment "staging" "3001"
test_environment "prod" "3002"

echo "🎉 All tests complete!"
echo ""
echo "📊 Summary:"
echo "- Development: http://localhost:3000"
echo "- Staging: http://localhost:3001"
echo "- Production: http://localhost:3002"