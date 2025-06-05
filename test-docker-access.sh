#!/bin/bash

echo "🔍 Testing Docker App Access"
echo "============================"
echo ""

# Test main page with verbose output
echo "1. Testing main page (/)..."
curl -v http://localhost:3000/ 2>&1 | grep -E "(HTTP/|Location:|< HTTP)"
echo ""

# Test dashboard
echo "2. Testing dashboard..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/dashboard
echo ""

# Test opportunities page  
echo "3. Testing opportunities page..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/opportunities
echo ""

# Test health endpoint with full response
echo "4. Testing health endpoint..."
curl -s http://localhost:3000/api/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/api/health
echo ""

# Check if it's a Supabase issue
echo "5. Checking environment in container..."
docker exec medcontract-dev printenv | grep -E "SUPABASE|NODE_ENV" | head -5
echo ""

echo "📝 Summary:"
echo "- If you see 307 redirects, it's likely due to missing Supabase config"
echo "- The app is running but needs real Supabase credentials"
echo "- You can update .env with your real values and restart"