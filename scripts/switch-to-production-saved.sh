#!/bin/bash

# Script to switch saved opportunities to production-ready version

echo "Switching to production-ready saved opportunities..."

# Backup current files
echo "Creating backups..."
cp app/(dashboard)/saved/page.tsx app/(dashboard)/saved/page-dev.tsx.bak 2>/dev/null || true
cp components/dashboard/opportunities/save-opportunity-button.tsx components/dashboard/opportunities/save-opportunity-button-dev.tsx.bak 2>/dev/null || true
cp components/dashboard/saved/saved-opportunities-container.tsx components/dashboard/saved/saved-opportunities-container-dev.tsx.bak 2>/dev/null || true

# Switch to production versions
echo "Switching to production versions..."
cp app/(dashboard)/saved/page-v2.tsx app/(dashboard)/saved/page.tsx
echo "✓ Updated saved page"

# Update imports in opportunities lists
echo "Updating imports..."
sed -i.bak 's/save-opportunity-button/save-opportunity-button-v2/g' components/dashboard/opportunities/opportunities-list.tsx
sed -i.bak 's/save-opportunity-button/save-opportunity-button-v2/g' components/dashboard/opportunities/virtualized-opportunities-list.tsx
echo "✓ Updated button imports"

# Update container import in saved page
sed -i.bak 's/saved-opportunities-container/saved-opportunities-container-v2/g' app/(dashboard)/saved/page.tsx
echo "✓ Updated container import"

echo ""
echo "✅ Successfully switched to production-ready saved opportunities!"
echo ""
echo "To rollback, run: ./scripts/rollback-saved-opportunities.sh"
echo ""
echo "Next steps:"
echo "1. Test locally: npm run dev"
echo "2. Build for production: npm run build"
echo "3. Deploy to production"