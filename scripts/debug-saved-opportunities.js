#!/usr/bin/env node

/**
 * Debug script to check saved opportunities in localStorage
 * Run this in the browser console while on the saved opportunities page
 */

const STORAGE_KEY = 'mock_saved_opportunities';

function debugSavedOpportunities() {
  console.log('=== Debugging Saved Opportunities ===');
  
  // Check if localStorage is available
  if (typeof window === 'undefined' || !window.localStorage) {
    console.error('localStorage not available');
    return;
  }
  
  // Get raw data from localStorage
  const rawData = localStorage.getItem(STORAGE_KEY);
  console.log('Raw localStorage data:', rawData);
  
  if (!rawData) {
    console.log('No saved opportunities found in localStorage');
    return;
  }
  
  try {
    const parsed = JSON.parse(rawData);
    console.log('Parsed data:', parsed);
    console.log('Number of saved opportunities:', parsed.length);
    
    // Show first item structure
    if (parsed.length > 0) {
      console.log('First saved opportunity structure:', parsed[0]);
      console.log('Opportunity data:', parsed[0].opportunity);
    }
    
    // Check current user ID from mock auth
    const authData = localStorage.getItem('mock_auth');
    if (authData) {
      const auth = JSON.parse(authData);
      console.log('Current user ID:', auth.user?.id);
      
      // Filter by current user
      const userOpps = parsed.filter(item => item.user_id === auth.user?.id);
      console.log('Opportunities for current user:', userOpps.length);
    }
    
  } catch (error) {
    console.error('Error parsing saved opportunities:', error);
  }
}

// Copy this function to browser console and run it
console.log('Copy and run this in browser console:');
console.log(debugSavedOpportunities.toString());
console.log('debugSavedOpportunities();');