#!/bin/bash

# Quick Deployment Script for MedContractHub
# This script helps with the deployment process

set -e

echo "🚀 MedContractHub Quick Deployment Script"
echo "========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run from project root."
    exit 1
fi

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required tools
echo "📋 Checking requirements..."
if ! command_exists node; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command_exists vercel; then
    echo "❌ Vercel CLI is not installed. Install with: npm i -g vercel"
    exit 1
fi

echo "✅ All requirements met"

# Select deployment type
echo ""
echo "Select deployment type:"
echo "1) Development (preview)"
echo "2) Staging"
echo "3) Production"
echo "4) Production build test (local)"
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo "🔧 Deploying to development..."
        vercel
        ;;
    2)
        echo "🔧 Deploying to staging..."
        vercel --target staging
        ;;
    3)
        echo "🚀 Deploying to PRODUCTION..."
        echo "⚠️  WARNING: This will deploy to production!"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            # Run production checks
            echo "Running pre-deployment checks..."
            
            # Check if .env.production exists
            if [ ! -f ".env.production" ]; then
                echo "❌ .env.production not found!"
                exit 1
            fi
            
            # Run build
            echo "Building application..."
            npm run build
            
            if [ $? -ne 0 ]; then
                echo "❌ Build failed!"
                exit 1
            fi
            
            echo "✅ Build successful"
            
            # Deploy to production
            vercel --prod
        else
            echo "Deployment cancelled"
            exit 0
        fi
        ;;
    4)
        echo "🧪 Testing production build locally..."
        
        # Copy production env
        if [ -f ".env.production" ]; then
            cp .env.production .env.local
            echo "✅ Using production environment"
        fi
        
        # Build
        echo "Building..."
        npm run build
        
        if [ $? -eq 0 ]; then
            echo "✅ Build successful"
            echo "Starting production server on http://localhost:3000"
            npm start
        else
            echo "❌ Build failed"
            exit 1
        fi
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment script completed!"