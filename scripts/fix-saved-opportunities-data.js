#!/usr/bin/env node

/**
 * Fix script for saved opportunities data structure
 * This script transforms saved opportunities to the correct format
 * Run in browser console if saved opportunities are not displaying
 */

console.log(`
// Fix saved opportunities data structure
(function fixSavedOpportunities() {
  const STORAGE_KEY = 'mock_saved_opportunities';
  const savedData = localStorage.getItem(STORAGE_KEY);
  
  if (!savedData) {
    console.log('No saved opportunities found');
    return;
  }
  
  try {
    const opportunities = JSON.parse(savedData);
    let fixed = 0;
    
    const fixedOpportunities = opportunities.map(opp => {
      // Check if opportunity data is properly nested
      if (!opp.opportunity && opp.title) {
        console.log('Fixing opportunity:', opp.id);
        fixed++;
        
        // Extract metadata fields
        const { 
          id, user_id, opportunity_id, 
          is_pursuing, notes, tags, 
          reminder_date, created_at,
          ...opportunityData 
        } = opp;
        
        // Return properly structured object
        return {
          id,
          user_id,
          opportunity_id: opportunity_id || opportunityData.id,
          is_pursuing: is_pursuing || false,
          notes: notes || '',
          tags: tags || [],
          reminder_date: reminder_date || null,
          created_at: created_at || new Date().toISOString(),
          opportunity: opportunityData
        };
      }
      return opp;
    });
    
    if (fixed > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fixedOpportunities));
      console.log(\`Fixed \${fixed} opportunities. Please refresh the page.\`);
    } else {
      console.log('All opportunities are properly structured');
    }
    
  } catch (error) {
    console.error('Error fixing opportunities:', error);
  }
})();
`);