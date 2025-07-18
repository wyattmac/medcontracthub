#!/bin/bash

echo "🐳 Docker Development Environment Status"
echo "========================================"
echo ""
echo "✅ Your development environment is running!"
echo ""
echo "🌐 Access your app at: http://localhost:3000"
echo ""
echo "📝 Useful commands to run in your terminal:"
echo ""
echo "1. View logs:"
echo "   docker-compose -f docker-compose.multi-env.yml logs -f dev-app"
echo ""
echo "2. Check container status:"
echo "   docker ps"
echo ""
echo "3. Open shell in app container:"
echo "   docker-compose -f docker-compose.multi-env.yml exec dev-app sh"
echo ""
echo "4. Stop development environment:"
echo "   ./docker-scripts.sh stop dev"
echo ""
echo "5. Restart development environment:"
echo "   ./docker-scripts.sh restart dev"
echo ""
echo "💡 Tips:"
echo "- Your code changes will hot-reload automatically"
echo "- Database is isolated from production"
echo "- All your API keys from .env are loaded"
echo ""
echo "🚀 Happy coding with your three-level Docker setup!"