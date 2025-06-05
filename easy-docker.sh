#!/bin/bash

# The EASIEST way to test your Docker setup
# Just run: ./easy-docker.sh

echo "🚀 Easy Docker Setup & Test"
echo "========================="
echo ""

# Simple menu
echo "What do you want to do?"
echo ""
echo "1. 🔥 Quick Start Development (most common)"
echo "2. 🧪 Test All Environments"
echo "3. 🛑 Stop Everything"
echo "4. 📊 Check Status"
echo ""
read -p "Choose (1-4): " choice

case $choice in
    1)
        echo "🔥 Starting development environment..."
        ./docker-scripts.sh start dev
        echo ""
        echo "✅ Done! Your app is at: http://localhost:3000"
        ;;
    2)
        echo "🧪 Testing all environments (this takes a few minutes)..."
        
        # Test dev
        echo "Testing development..."
        ./docker-scripts.sh start dev
        sleep 5
        curl -s http://localhost:3000 > /dev/null && echo "✅ Dev works" || echo "❌ Dev failed"
        
        # Test staging  
        echo "Testing staging..."
        ./docker-scripts.sh stop dev
        ./docker-scripts.sh start staging
        sleep 5
        curl -s http://localhost:3001 > /dev/null && echo "✅ Staging works" || echo "❌ Staging failed"
        
        # Test production
        echo "Testing production..."
        ./docker-scripts.sh stop staging
        ./docker-scripts.sh start prod
        sleep 5
        curl -s http://localhost:3002 > /dev/null && echo "✅ Production works" || echo "❌ Production failed"
        
        echo ""
        echo "🎉 All tests complete!"
        echo "Production is running at: http://localhost:3002"
        ;;
    3)
        echo "🛑 Stopping all environments..."
        ./docker-scripts.sh stop all
        echo "✅ Everything stopped"
        ;;
    4)
        echo "📊 Current status:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep medcontract || echo "No containers running"
        ;;
    *)
        echo "❌ Invalid choice"
        ;;
esac