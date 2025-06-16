# Debugging Saved Opportunities

## Issue
Saved opportunities are not showing up on the saved page.

## Debug Steps

### 1. Test Debug Page
Navigate to: http://localhost:3000/test-saved

This page will show:
- Current user ID
- Number of saved opportunities
- Raw localStorage data
- Ability to add test opportunities

### 2. Browser Console Debug
Run this in the browser console while on any page:

```javascript
// Check saved opportunities
const STORAGE_KEY = 'mock_saved_opportunities';
const rawData = localStorage.getItem(STORAGE_KEY);
console.log('Raw data:', rawData);

if (rawData) {
  const parsed = JSON.parse(rawData);
  console.log('Parsed opportunities:', parsed);
  
  // Check current user
  const authData = localStorage.getItem('mock_auth');
  if (authData) {
    const auth = JSON.parse(authData);
    console.log('Current user ID:', auth.user?.id);
    
    const userOpps = parsed.filter(item => item.user_id === auth.user?.id);
    console.log('User opportunities:', userOpps);
  }
}
```

### 3. Save a Test Opportunity
1. Go to http://localhost:3000/dashboard/opportunities
2. Click the bookmark icon on any opportunity
3. Check the console for debug messages
4. Go to http://localhost:3000/dashboard/saved
5. Check if the opportunity appears

### 4. Check Console Logs
The following components now have debug logging:
- SaveOpportunityButton: Logs when saving/unsaving
- SavedOpportunitiesContainer: Logs data retrieval
- mockSavedOpportunitiesStore: Logs storage operations

### 5. Fixed Issues
1. **Data transformation bug**: The container was incorrectly transforming the data structure
2. **Missing opportunity data**: Now passing full opportunity object when saving

## Quick Fix
If opportunities still don't show after saving:
1. Clear localStorage: `localStorage.clear()`
2. Refresh the page
3. Log in again
4. Save a new opportunity
5. Check the saved page