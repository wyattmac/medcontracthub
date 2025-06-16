#!/usr/bin/env node

/**
 * Test script for saved opportunities functionality
 * Run with: node scripts/test-save-functionality.js
 */

console.log('Testing Saved Opportunities Functionality\n');

// Test 1: Check localStorage structure
console.log('1. Checking localStorage structure:');
console.log('   - Open browser dev tools');
console.log('   - Run: localStorage.getItem("mock_saved_opportunities")');
console.log('   - Should see an array of saved opportunities\n');

// Test 2: Save opportunity flow
console.log('2. Test saving an opportunity:');
console.log('   a. Go to http://localhost:3000/opportunities');
console.log('   b. Click the bookmark icon on any opportunity');
console.log('   c. Check browser console for debug logs');
console.log('   d. Icon should change to filled bookmark\n');

// Test 3: View saved opportunities
console.log('3. Test viewing saved opportunities:');
console.log('   a. Go to http://localhost:3000/saved');
console.log('   b. Should see the saved opportunity');
console.log('   c. Check browser console for container logs\n');

// Test 4: Unsave opportunity
console.log('4. Test unsaving an opportunity:');
console.log('   a. Click the filled bookmark icon');
console.log('   b. Icon should change back to outline');
console.log('   c. Refresh saved page - opportunity should be gone\n');

// Debug commands
console.log('Debug Commands for Browser Console:\n');
console.log(`
// Check current user
const authData = JSON.parse(localStorage.getItem('mock_auth'));
console.log('Current user:', authData?.user);

// Check saved opportunities
const savedData = JSON.parse(localStorage.getItem('mock_saved_opportunities') || '[]');
console.log('Total saved:', savedData.length);
console.log('User saved:', savedData.filter(s => s.user_id === authData?.user?.id));

// Clear all saved opportunities (for testing)
// localStorage.removeItem('mock_saved_opportunities');

// Add test opportunity manually
const testOpp = {
  id: 'saved_' + Date.now(),
  user_id: authData?.user?.id,
  opportunity_id: 'test-opp-123',
  opportunity: {
    id: 'test-opp-123',
    title: 'Test Medical Supply Contract',
    description: 'Test opportunity for debugging',
    agency: 'Test Agency',
    response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    matchScore: 0.85,
    status: 'active'
  },
  is_pursuing: false,
  notes: '',
  tags: [],
  reminder_date: null,
  created_at: new Date().toISOString()
};
const existing = JSON.parse(localStorage.getItem('mock_saved_opportunities') || '[]');
existing.push(testOpp);
localStorage.setItem('mock_saved_opportunities', JSON.stringify(existing));
console.log('Test opportunity added!');
`);

console.log('\nExpected Console Logs:');
console.log('- SaveOpportunityButton: "Saving opportunity: <id> with data: <data>"');
console.log('- SavedOpportunitiesContainer: "saved opportunities from store: [...]"');
console.log('- SavedOpportunitiesContainer: "transformed opportunities: [...]"');

console.log('\nIf opportunities are not showing up:');
console.log('1. Check if data transformation is working correctly');
console.log('2. Verify opportunity data is being passed to save button');
console.log('3. Check for console errors in saved opportunities list');
console.log('4. Try clearing localStorage and starting fresh');