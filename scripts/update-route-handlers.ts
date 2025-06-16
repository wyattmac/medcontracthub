#!/usr/bin/env tsx

/**
 * Script to update all API routes to use the new Next.js 15 compatible route handler
 */

import { readFile, writeFile } from 'fs/promises'
import { glob } from 'glob'
import path from 'path'

async function updateRouteHandlers() {
  console.log('🔄 Updating API routes to use Next.js 15 compatible route handler...')
  
  try {
    // Find all route files in the API directory
    const apiFiles = await glob('app/api/**/route.ts', {
      ignore: ['**/node_modules/**', '**/.next/**']
    })
    
    console.log(`Found ${apiFiles.length} route files`)
    
    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0
    
    for (const filePath of apiFiles) {
      try {
        const content = await readFile(filePath, 'utf-8')
        
        // Check if it uses the old route handler
        if (content.includes("from '@/lib/api/route-handler'")) {
          // Replace the import
          const updatedContent = content.replace(
            /from\s+['"]@\/lib\/api\/route-handler['"]/g,
            "from '@/lib/api/route-handler-next15'"
          )
          
          await writeFile(filePath, updatedContent, 'utf-8')
          console.log(`✅ Updated: ${filePath}`)
          updatedCount++
        } else if (content.includes("from '@/lib/api/route-handler-next15'")) {
          console.log(`⏭️  Already updated: ${filePath}`)
          skippedCount++
        } else {
          console.log(`⚠️  No route handler import found: ${filePath}`)
          skippedCount++
        }
      } catch (error) {
        console.error(`❌ Error updating ${filePath}:`, error)
        errorCount++
      }
    }
    
    console.log('\n📊 Summary:')
    console.log(`  ✅ Updated: ${updatedCount} files`)
    console.log(`  ⏭️  Skipped: ${skippedCount} files`)
    console.log(`  ❌ Errors: ${errorCount} files`)
    
    if (errorCount > 0) {
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  }
}

// Run the script
updateRouteHandlers().catch(console.error)