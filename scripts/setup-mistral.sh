#!/bin/bash

# Script to safely add Mistral API key to .env.local

echo "Setting up Mistral API key..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "Creating .env.local from .env.local.example..."
    cp .env.local.example .env.local
fi

# Check if MISTRAL_API_KEY already exists in .env.local
if grep -q "MISTRAL_API_KEY=" .env.local; then
    echo "MISTRAL_API_KEY already exists in .env.local"
    echo "Would you like to update it? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        echo "Exiting without changes."
        exit 0
    fi
    # Remove the existing line
    sed -i.bak '/MISTRAL_API_KEY=/d' .env.local
fi

# Add the Mistral API key
echo "" >> .env.local
echo "# Wholesale Distributor AI" >> .env.local
echo "MISTRAL_API_KEY=kHrG0LTUXGCXLUKF5M9mZVBbpJjWmKhF" >> .env.local

echo "✅ Mistral API key has been added to .env.local"
echo ""
echo "Note: This API key is now stored locally and will not be committed to git."
echo "Make sure to keep your .env.local file secure!"