#!/bin/bash

# Test Docker connectivity from WSL

echo "🔍 Testing Docker connectivity..."
echo ""

# Test direct commands
if command -v docker &> /dev/null; then
    echo "✅ Native docker command found"
    docker --version
elif command -v docker.exe &> /dev/null; then
    echo "⚠️  Using docker.exe from Windows"
    docker.exe --version
else
    echo "❌ Docker not found in PATH"
fi

echo ""

# Test docker-compose
if command -v docker-compose &> /dev/null; then
    echo "✅ Native docker-compose command found"
    docker-compose --version
elif command -v docker-compose.exe &> /dev/null; then
    echo "⚠️  Using docker-compose.exe from Windows"
    docker-compose.exe --version
else
    echo "❌ docker-compose not found in PATH"
fi

echo ""

# Test Docker daemon
if docker version &> /dev/null || docker.exe version &> /dev/null; then
    echo "✅ Docker daemon is running"
else
    echo "❌ Cannot connect to Docker daemon"
    echo "   Make sure Docker Desktop is running on Windows"
fi

echo ""
echo "📋 Next steps:"
echo "1. If you see ❌ errors above, follow DOCKER_WSL_SETUP.md"
echo "2. If everything shows ✅, run: ./docker-scripts.sh start dev"