#!/bin/bash

# Script to rollback to development version of saved opportunities

echo "Rolling back to development saved opportunities..."

# Restore from backups
echo "Restoring from backups..."
if [ -f "app/(dashboard)/saved/page-dev.tsx.bak" ]; then
    cp app/(dashboard)/saved/page-dev.tsx.bak app/(dashboard)/saved/page.tsx
    echo "✓ Restored saved page"
else
    echo "⚠ No backup found for saved page"
fi

if [ -f "components/dashboard/opportunities/save-opportunity-button-dev.tsx.bak" ]; then
    cp components/dashboard/opportunities/save-opportunity-button-dev.tsx.bak components/dashboard/opportunities/save-opportunity-button.tsx
    echo "✓ Restored save button"
else
    echo "⚠ No backup found for save button"
fi

if [ -f "components/dashboard/saved/saved-opportunities-container-dev.tsx.bak" ]; then
    cp components/dashboard/saved/saved-opportunities-container-dev.tsx.bak components/dashboard/saved/saved-opportunities-container.tsx
    echo "✓ Restored container"
else
    echo "⚠ No backup found for container"
fi

# Restore original imports
echo "Restoring imports..."
if [ -f "components/dashboard/opportunities/opportunities-list.tsx.bak" ]; then
    mv components/dashboard/opportunities/opportunities-list.tsx.bak components/dashboard/opportunities/opportunities-list.tsx
    echo "✓ Restored opportunities list"
fi

if [ -f "components/dashboard/opportunities/virtualized-opportunities-list.tsx.bak" ]; then
    mv components/dashboard/opportunities/virtualized-opportunities-list.tsx.bak components/dashboard/opportunities/virtualized-opportunities-list.tsx
    echo "✓ Restored virtualized list"
fi

echo ""
echo "✅ Successfully rolled back to development version!"
echo ""
echo "To switch back to production, run: ./scripts/switch-to-production-saved.sh"