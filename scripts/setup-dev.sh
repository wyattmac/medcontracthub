#!/bin/bash

# Development Environment Setup Script
# Run this after cloning the repository

echo "🚀 Setting up MedContractHub development environment..."

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment files
if [ ! -f .env.local ]; then
    echo "📋 Creating .env.local from example..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your API keys!"
fi

# Set up git hooks
echo "🔗 Setting up git commit template..."
git config --local commit.template .gitmessage

# Create required directories
echo "📁 Creating required directories..."
mkdir -p .claude
mkdir -p scripts/cron

# Install Stripe CLI (optional)
read -p "Would you like to install Stripe CLI for webhook testing? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install stripe/stripe-cli/stripe
    else
        echo "📥 Please install Stripe CLI manually from: https://stripe.com/docs/stripe-cli"
    fi
fi

# Generate TypeScript types
echo "🔧 Generating TypeScript types..."
npm run db:types || echo "⚠️  Skipping type generation (requires Supabase connection)"

# Run initial tests
echo "🧪 Running tests..."
npm test

# Success message
echo "
✅ Development environment setup complete!

Next steps:
1. Update .env.local with your API keys
2. Run 'npm run dev' to start the development server
3. Visit http://localhost:3000

Useful commands:
- npm run dev          Start development server
- npm test            Run tests
- npm run lint        Run linter
- npm run type-check  Check TypeScript types
- npm run build       Build for production

For Claude Code:
- Use 'claude' command to start Claude Code
- Check .claude/settings.json for configuration
- Read CLAUDE.md for project-specific guidelines
"