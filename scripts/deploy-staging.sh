#!/bin/bash

# Deploy to Staging Environment
# This script helps deploy to Vercel staging

echo "🚀 Deploying to Staging Environment..."

# Check if on develop branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
    echo "⚠️  Warning: You're not on the develop branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Run tests first
echo "🧪 Running tests..."
npm test || {
    echo "❌ Tests failed! Fix them before deploying."
    exit 1
}

# Type check
echo "📝 Running type check..."
npm run type-check || {
    echo "❌ Type check failed! Fix errors before deploying."
    exit 1
}

# Lint check
echo "🔍 Running linter..."
npm run lint || {
    echo "❌ Linting failed! Fix errors before deploying."
    exit 1
}

# Build locally to catch errors
echo "🏗️ Building application..."
npm run build || {
    echo "❌ Build failed! Fix errors before deploying."
    exit 1
}

# Push to GitHub (triggers deployment)
echo "📤 Pushing to GitHub..."
git push origin develop

echo "
✅ Deployment initiated!

GitHub Actions will:
1. Run tests again
2. Build the application
3. Deploy to Vercel staging

Monitor progress at:
https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions

Staging URL will be available at:
https://staging.medcontracthub.com

To check deployment status:
vercel --token \$VERCEL_TOKEN
"