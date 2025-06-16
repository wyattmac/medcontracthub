#!/usr/bin/env npx tsx
/**
 * Migration script to anonymize and share high-quality existing OCR extractions
 * to the community database
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import crypto from 'crypto'
import dotenv from 'dotenv'
import { syncLogger } from '@/lib/errors/logger'

dotenv.config({ path: '.env.local' })

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MigrationStats {
  total: number
  migrated: number
  skipped: number
  errors: number
}

/**
 * Calculate document fingerprint
 */
function calculateFingerprint(text: string, metadata: any): string {
  const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ')
  const combined = normalizedText + 
    (metadata?.structure || '') + 
    (metadata?.type || '')
  
  const hash = crypto.createHash('sha256').update(combined).digest('hex')
  return hash.substring(0, 16)
}

/**
 * Calculate text hash
 */
function calculateTextHash(text: string): string {
  const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ')
  return crypto.createHash('sha256').update(normalizedText).digest('hex')
}

/**
 * Anonymize sensitive data from OCR results
 */
function anonymizeData(data: any): any {
  if (!data) return data
  
  // Deep clone to avoid modifying original
  const anonymized = JSON.parse(JSON.stringify(data))
  
  // Remove patterns that might contain sensitive info
  const sensitivePatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{2}-\d{7}\b/g, // EIN
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // Email
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phone
    /\b\d{5}(-\d{4})?\b/g, // ZIP code (might be too aggressive)
  ]
  
  const anonymizeString = (str: string): string => {
    let result = str
    for (const pattern of sensitivePatterns) {
      result = result.replace(pattern, '[REDACTED]')
    }
    return result
  }
  
  const anonymizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return anonymizeString(obj)
    } else if (Array.isArray(obj)) {
      return obj.map(anonymizeObject)
    } else if (obj && typeof obj === 'object') {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        // Skip certain sensitive keys entirely
        if (['email', 'phone', 'address', 'contact'].includes(key.toLowerCase())) {
          result[key] = '[REMOVED]'
        } else {
          result[key] = anonymizeObject(value)
        }
      }
      return result
    }
    return obj
  }
  
  return anonymizeObject(anonymized)
}

/**
 * Check if extraction is high quality
 */
function isHighQuality(doc: any): boolean {
  // Criteria for high-quality extractions:
  // 1. Successfully completed
  if (doc.ocr_status !== 'completed') return false
  
  // 2. Has meaningful extracted text
  if (!doc.extracted_text || doc.extracted_text.length < 100) return false
  
  // 3. Has structured data or requirements
  const hasStructuredData = doc.structured_data && 
    Object.keys(doc.structured_data).length > 0
  const hasRequirements = doc.extracted_requirements && 
    doc.extracted_requirements.length > 0
  
  if (!hasStructuredData && !hasRequirements) return false
  
  // 4. No processing errors
  if (doc.processing_error) return false
  
  // 5. Used in a successful sourcing report (if available)
  // This would require joining with sourcing_reports table
  
  return true
}

/**
 * Migrate high-quality extractions to community database
 */
async function migrateExtractions(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0
  }
  
  try {
    // Start migration tracking
    const { data: migrationState } = await supabase.rpc('start_migration', {
      p_migration_name: 'community_ocr_initial_seed',
      p_migration_type: 'backfill',
      p_entity_type: 'documents',
      p_target_system: 'postgresql',
      p_config: { anonymize: true, quality_threshold: 'high' },
      p_dry_run: false
    })
    
    const migrationId = migrationState
    
    syncLogger.info('Starting community extraction migration', { migrationId })
    
    // Fetch documents in batches
    const batchSize = 100
    let hasMore = true
    let lastId: string | null = null
    
    while (hasMore) {
      // Build query
      let query = supabase
        .from('contract_documents')
        .select(`
          id,
          file_name,
          file_type,
          file_size,
          ocr_status,
          ocr_result,
          extracted_text,
          structured_data,
          extracted_requirements,
          metadata,
          processing_time_ms,
          processing_error
        `)
        .eq('ocr_status', 'completed')
        .not('extracted_text', 'is', null)
        .order('id')
        .limit(batchSize)
      
      if (lastId) {
        query = query.gt('id', lastId)
      }
      
      const { data: documents, error } = await query
      
      if (error) {
        syncLogger.error('Failed to fetch documents', error)
        stats.errors++
        break
      }
      
      if (!documents || documents.length === 0) {
        hasMore = false
        break
      }
      
      stats.total += documents.length
      lastId = documents[documents.length - 1].id
      
      // Process each document
      const processedIds: string[] = []
      
      for (const doc of documents) {
        try {
          // Check quality
          if (!isHighQuality(doc)) {
            stats.skipped++
            continue
          }
          
          // Calculate fingerprint
          const fingerprint = calculateFingerprint(
            doc.extracted_text!,
            doc.metadata
          )
          const textHash = calculateTextHash(doc.extracted_text!)
          
          // Check if already exists
          const { data: existing } = await supabase
            .from('community_extractions')
            .select('id')
            .eq('document_fingerprint', fingerprint)
            .single()
          
          if (existing) {
            // Update verification count
            await supabase
              .from('community_extractions')
              .update({
                verification_count: 1, // Will be incremented by SQL
                last_verified_at: new Date().toISOString()
              })
              .eq('id', existing.id)
            
            stats.skipped++
            continue
          }
          
          // Anonymize data
          const anonymizedStructuredData = anonymizeData(doc.structured_data)
          const anonymizedRequirements = anonymizeData(doc.extracted_requirements)
          const anonymizedMetadata = {
            source: 'migration',
            originalType: doc.file_type,
            migrationBatch: migrationId
          }
          
          // Determine document type from filename/metadata
          const docType = doc.file_type || 'application/pdf'
          
          // Insert into community extractions
          const { error: insertError } = await supabase
            .from('community_extractions')
            .insert({
              document_fingerprint: fingerprint,
              document_type: docType,
              file_size_bytes: doc.file_size,
              page_count: doc.metadata?.pageCount || 1,
              extracted_text: doc.extracted_text!,
              structured_data: anonymizedStructuredData || {},
              extracted_requirements: anonymizedRequirements || [],
              metadata: anonymizedMetadata,
              ocr_model: doc.metadata?.model || 'unknown',
              processing_time_ms: doc.processing_time_ms,
              text_hash: textHash,
              confidence_score: 0.8, // High quality extractions start with good score
              contributor_count: 1
            })
          
          if (insertError) {
            syncLogger.error('Failed to insert extraction', insertError, { docId: doc.id })
            stats.errors++
            continue
          }
          
          processedIds.push(doc.id)
          stats.migrated++
          
        } catch (error) {
          syncLogger.error('Error processing document', error as Error, { docId: doc.id })
          stats.errors++
        }
      }
      
      // Save checkpoint
      if (processedIds.length > 0 && migrationId) {
        await supabase.rpc('save_migration_checkpoint', {
          p_migration_id: migrationId,
          p_processed_ids: processedIds,
          p_last_successful_id: processedIds[processedIds.length - 1],
          p_batch_time_ms: 1000 // Approximate
        })
      }
      
      // Log progress
      syncLogger.info('Migration batch completed', {
        processed: stats.migrated,
        skipped: stats.skipped,
        errors: stats.errors,
        total: stats.total
      })
    }
    
    // Complete migration
    if (migrationId) {
      await supabase
        .from('data_migration_state')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_processed: stats.migrated,
          total_failed: stats.errors,
          total_skipped: stats.skipped
        })
        .eq('id', migrationId)
    }
    
  } catch (error) {
    syncLogger.error('Migration failed', error as Error)
    stats.errors++
  }
  
  return stats
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting community extraction migration...')
  console.log('This will anonymize and share high-quality OCR extractions.')
  console.log('')
  
  const startTime = Date.now()
  const stats = await migrateExtractions()
  const duration = Date.now() - startTime
  
  console.log('\n📊 Migration Results:')
  console.log(`Total documents checked: ${stats.total}`)
  console.log(`Successfully migrated: ${stats.migrated}`)
  console.log(`Skipped (low quality or duplicate): ${stats.skipped}`)
  console.log(`Errors: ${stats.errors}`)
  console.log(`Duration: ${(duration / 1000).toFixed(2)}s`)
  console.log(`Success rate: ${((stats.migrated / stats.total) * 100).toFixed(1)}%`)
  
  if (stats.errors > 0) {
    console.log('\n⚠️  Some errors occurred during migration. Check logs for details.')
    process.exit(1)
  } else {
    console.log('\n✅ Migration completed successfully!')
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { migrateExtractions, calculateFingerprint, anonymizeData }