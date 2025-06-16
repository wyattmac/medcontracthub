# Saved Opportunities - Production Migration Guide

## Overview
The saved opportunities feature has been updated to work seamlessly in both development and production environments.

## Key Changes

### 1. Universal Auth Hook (`/lib/hooks/useAuth.ts`)
- Automatically detects environment (development vs production)
- Returns appropriate auth state based on environment
- No code changes needed when deploying

### 2. Save Button V2 (`save-opportunity-button-v2.tsx`)
- Works with both mock auth (dev) and Supabase auth (prod)
- Handles localStorage in development
- Uses real API with CSRF in production

### 3. Saved Container V2 (`saved-opportunities-container-v2.tsx`)
- Automatically switches between localStorage and API
- Maintains same interface in both environments
- Proper error handling for both modes

## Migration Steps

### Step 1: Update Imports in Opportunities List
```tsx
// Old
import { SaveOpportunityButton } from './save-opportunity-button'

// New
import { SaveOpportunityButton } from './save-opportunity-button-v2'
```

### Step 2: Update Saved Page
```tsx
// Rename current saved/page.tsx to saved/page-old.tsx
// Rename saved/page-v2.tsx to saved/page.tsx
```

### Step 3: Update Container Import
```tsx
// In saved/page.tsx, change:
import { SavedOpportunitiesContainer } from '@/components/dashboard/saved/saved-opportunities-container-v2'
```

## Environment Configuration

### Development (.env.local)
```env
NODE_ENV=development
NEXT_PUBLIC_DEVELOPMENT_AUTH_BYPASS=true
```

### Production (.env.production)
```env
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## How It Works

### Development Mode
1. Uses mock authentication from `MockAuthProvider`
2. Stores saved opportunities in localStorage
3. No real API calls to Supabase
4. Data persists across page refreshes

### Production Mode
1. Uses real Supabase authentication
2. Stores saved opportunities in database
3. Enforces Row Level Security (RLS)
4. Each user sees only their saved items

## API Endpoints

### `/api/opportunities/save`
- **Development**: Routes to `/api/opportunities/save-dev`
- **Production**: Uses enhanced route handler with auth

### `/api/opportunities/saved`
- **Development**: Returns data from localStorage (client-side)
- **Production**: Queries database with user filtering

## Testing

### Development Testing
1. Start dev server: `npm run dev`
2. Navigate to opportunities page
3. Click save buttons - data stored in localStorage
4. Go to saved page - see your saved items

### Production Testing
1. Build: `npm run build`
2. Start: `npm start`
3. Log in with real account
4. Save opportunities - stored in database
5. Verify only your saved items appear

## Security Considerations

1. **Development**: No real authentication, data in localStorage
2. **Production**: 
   - Real authentication required
   - RLS policies enforce user isolation
   - CSRF protection on mutations
   - No access to other users' data

## Rollback Plan

If issues arise, you can quickly rollback:
1. Rename `page-old.tsx` back to `page.tsx`
2. Use original `save-opportunity-button.tsx`
3. Use original `saved-opportunities-container.tsx`

## Benefits

1. **Single Codebase**: Same components work in both environments
2. **No Manual Changes**: Automatic environment detection
3. **Secure**: Production uses real auth and RLS
4. **Developer Friendly**: Easy local testing with persistence
5. **Zero SAM.gov API Calls**: Saved page only shows already-fetched data