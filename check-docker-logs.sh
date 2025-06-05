#!/bin/bash

echo "📋 Checking MedContractHub Docker Logs..."
echo "========================================"
echo ""

# Check if containers are running
echo "🐳 Running Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep medcontract || echo "No medcontract containers found"
echo ""

# Check recent app logs
echo "📝 Recent App Logs:"
echo "-------------------"
docker logs medcontract-dev --tail 20 2>&1 || echo "Could not fetch app logs"
echo ""

# Check for common issues
echo "🔍 Checking for Common Issues:"
echo "------------------------------"

# Check if app started successfully
if docker logs medcontract-dev 2>&1 | grep -q "Ready on http"; then
    echo "✅ Next.js server started successfully"
else
    echo "⚠️  Next.js server may not have started properly"
fi

# Check for database connection
if docker logs medcontract-dev 2>&1 | grep -q "ECONNREFUSED"; then
    echo "❌ Database connection issues detected"
else
    echo "✅ No database connection errors found"
fi

# Check for missing env vars
if docker logs medcontract-dev 2>&1 | grep -q "Missing required environment"; then
    echo "❌ Missing environment variables"
else
    echo "✅ No missing environment variable errors"
fi

echo ""
echo "💡 To see live logs, run:"
echo "   docker logs -f medcontract-dev"