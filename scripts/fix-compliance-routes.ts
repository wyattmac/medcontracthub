#!/usr/bin/env tsx

/**
 * Script to fix compliance routes that use withErrorHandler and UnauthorizedError
 */

import { readFile, writeFile } from 'fs/promises'
import { glob } from 'glob'
import path from 'path'

async function fixComplianceRoutes() {
  console.log('🔧 Fixing compliance routes...')
  
  try {
    // Find all compliance route files
    const complianceFiles = await glob('app/api/compliance/**/route.ts')
    const proposalFiles = await glob('app/api/proposals/**/route.ts')
    const allFiles = [...complianceFiles, ...proposalFiles]
    
    console.log(`Found ${allFiles.length} files to check`)
    
    let fixedCount = 0
    
    for (const filePath of allFiles) {
      try {
        let content = await readFile(filePath, 'utf-8')
        let modified = false
        
        // Replace UnauthorizedError with AuthenticationError
        if (content.includes('UnauthorizedError')) {
          content = content.replace(/UnauthorizedError/g, 'AuthenticationError')
          modified = true
        }
        
        // Remove withErrorHandler import
        if (content.includes("import { withErrorHandler }")) {
          content = content.replace(
            /import { withErrorHandler } from '@\/lib\/api\/error-interceptor'\n/g,
            ''
          )
          modified = true
        }
        
        // Fix imports that have both withErrorHandler and other imports
        if (content.includes("withErrorHandler,")) {
          content = content.replace(/withErrorHandler,\s*/g, '')
          modified = true
        }
        
        // Remove withErrorHandler usage
        if (content.includes('withErrorHandler(')) {
          // This is more complex - need to remove the wrapper
          content = content.replace(
            /export const (GET|POST|PUT|DELETE|PATCH) = withErrorHandler\(async \((.*?)\) => \{/g,
            'export const $1 = async ($2) => {\n  try {'
          )
          
          // Find and fix the closing syntax
          content = content.replace(
            /\}\), \{[\s\S]*?\}\)/g,
            (match) => {
              // Extract the body up to the last closing brace
              return `  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}`
            }
          )
          modified = true
        }
        
        if (modified) {
          await writeFile(filePath, content, 'utf-8')
          console.log(`✅ Fixed: ${filePath}`)
          fixedCount++
        }
      } catch (error) {
        console.error(`❌ Error fixing ${filePath}:`, error)
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} files`)
    
  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  }
}

// Run the script
fixComplianceRoutes().catch(console.error)