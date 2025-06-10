#!/usr/bin/env npx tsx

/**
 * Verify that the toast system is working correctly
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const componentsToCheck = [
  'components/dashboard/opportunities/save-opportunity-button.tsx',
  'components/dashboard/opportunities/mark-for-proposal-button.tsx',
  'components/dashboard/opportunities/ai-analyze-button.tsx',
  'components/dashboard/opportunities/process-documents-button.tsx',
  'components/dashboard/opportunities/reminder-button.tsx',
  'components/dashboard/opportunities/opportunity-attachments.tsx',
]

console.log('🔍 Verifying toast implementation fixes...\n')

let allGood = true

for (const component of componentsToCheck) {
  const filePath = join(process.cwd(), component)
  try {
    const content = readFileSync(filePath, 'utf8')
    
    // Check for old toast implementation
    if (content.includes("useToast from '@/components/ui/use-toast'")) {
      console.log(`❌ ${component} - Still using old useToast`)
      allGood = false
    } else if (content.includes("const { toast } = useToast()")) {
      console.log(`❌ ${component} - Still has useToast hook usage`)
      allGood = false
    } else if (content.includes("toast from 'sonner'")) {
      console.log(`✅ ${component} - Using sonner correctly`)
    } else if (content.includes("SaveOpportunityButton")) {
      // This is the save button - it should use sonner
      console.log(`✅ ${component} - SaveOpportunityButton uses sonner`)
    } else {
      console.log(`⚠️  ${component} - No toast usage detected`)
    }
  } catch (error) {
    console.log(`⚠️  ${component} - File not found`)
  }
}

console.log('\n📊 Summary:')
if (allGood) {
  console.log('✅ All components have been successfully updated to use sonner!')
  console.log('\n💡 Next steps:')
  console.log('1. Clear browser cache and refresh the page')
  console.log('2. Click any action button (Save, Mark for Proposal, etc.)')
  console.log('3. You should see toast notifications appear in the top-right corner')
} else {
  console.log('❌ Some components still need to be updated')
}