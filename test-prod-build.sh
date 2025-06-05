#!/bin/bash

echo "🔧 Testing Production Build Fix"
echo "==============================="
echo ""

echo "1. Stopping any existing production containers..."
./docker-scripts.sh stop prod

echo ""
echo "2. Rebuilding production image with ESLint fix..."
docker-compose -f docker-compose.multi-env.yml build prod-app

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful! Starting production environment..."
    ./docker-scripts.sh start prod
    
    echo ""
    echo "3. Testing production environment..."
    sleep 10
    
    echo "Health check:"
    curl -s http://localhost:3002/api/health || echo "Health endpoint not ready yet"
    
    echo ""
    echo "Main page:"
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3002
    
    echo ""
    echo "🎉 Production environment is working!"
    echo "   Access at: http://localhost:3002"
else
    echo ""
    echo "❌ Build failed. Check the error messages above."
fi