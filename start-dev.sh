#!/bin/bash

# Start Next.js dev server in background
echo "🚀 Starting MedContractHub development server..."
npm run dev > dev-server.log 2>&1 &
DEV_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
sleep 8

# Check if server is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Server is running at http://localhost:3000"
    echo "📋 Server PID: $DEV_PID"
    echo "📄 Logs: tail -f dev-server.log"
    
    # Try to open browser (works in WSL)
    if command -v explorer.exe &> /dev/null; then
        echo "🌐 Opening browser..."
        explorer.exe "http://localhost:3000" 2>/dev/null || true
    elif command -v wslview &> /dev/null; then
        echo "🌐 Opening browser..."
        wslview "http://localhost:3000" 2>/dev/null || true
    fi
    
    echo ""
    echo "🎉 MedContractHub is ready!"
    echo "   Dashboard: http://localhost:3000/dashboard"
    echo "   Opportunities: http://localhost:3000/dashboard/opportunities"
    echo ""
    echo "💡 To stop the server: kill $DEV_PID"
    echo "💡 To view logs: tail -f dev-server.log"
    
else
    echo "❌ Server failed to start. Check dev-server.log for details."
    kill $DEV_PID 2>/dev/null || true
    exit 1
fi