/**
 * SAM.gov Opportunity Parsing and Database Integration Utilities
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { ISAMOpportunity } from './types'

type OpportunityRow = Database['public']['Tables']['opportunities']['Row']
type OpportunityInsert = Database['public']['Tables']['opportunities']['Insert']

/**
 * Parse SAM.gov opportunity status to database enum
 */
export function parseOpportunityStatus(samOpportunity: ISAMOpportunity): 'active' | 'awarded' | 'cancelled' | 'expired' {
  if (samOpportunity.award) {
    return 'awarded'
  }
  
  if (samOpportunity.active === 'false') {
    return 'expired'
  }
  
  if (samOpportunity.archiveType === 'autocancelled' || samOpportunity.archiveType === 'cancelled') {
    return 'cancelled'
  }
  
  return 'active'
}

/**
 * Parse date strings from SAM.gov to proper timestamps
 */
export function parseDate(dateString: string): string | null {
  if (!dateString) return null
  
  try {
    const date = new Date(dateString)
    return date.toISOString()
  } catch (error) {
    console.warn(`Failed to parse date: ${dateString}`, error)
    return null
  }
}

/**
 * Extract estimated value from opportunity description and title
 */
export function extractEstimatedValue(opportunity: ISAMOpportunity): {
  min: number | null
  max: number | null
} {
  const text = `${opportunity.title} ${opportunity.description || ''}`.toLowerCase()
  
  // Common patterns for contract values
  const patterns = [
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:million|m)/g,
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:thousand|k)/g,
    /\$\s*([\d,]+(?:\.\d{2})?)/g,
    /(\d{1,3}(?:,\d{3})*)\s*(?:million|m)/g,
    /(\d{1,3}(?:,\d{3})*)\s*(?:thousand|k)/g,
  ]
  
  const values: number[] = []
  
  patterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const numStr = match[1].replace(/,/g, '')
      const num = parseFloat(numStr)
      
      if (!isNaN(num)) {
        if (text.includes('million') || text.includes(' m ')) {
          values.push(num * 1000000)
        } else if (text.includes('thousand') || text.includes(' k ')) {
          values.push(num * 1000)
        } else {
          values.push(num)
        }
      }
    }
  })
  
  if (values.length === 0) {
    return { min: null, max: null }
  }
  
  const min = Math.min(...values)
  const max = Math.max(...values)
  
  return {
    min: values.length === 1 ? null : min,
    max: values.length === 1 ? min : max
  }
}

/**
 * Map SAM.gov opportunity to database format
 */
export function mapSAMOpportunityToDatabase(samOpp: ISAMOpportunity): OpportunityInsert {
  const estimatedValue = extractEstimatedValue(samOpp)
  
  // Extract NAICS description from common patterns
  const naicsDescription = samOpp.classificationCode || null
  
  return {
    notice_id: samOpp.noticeId,
    title: samOpp.title,
    description: samOpp.description || null,
    agency: samOpp.fullParentPathName,
    sub_agency: samOpp.fullParentPathCode || null,
    office: samOpp.officeAddress?.city?.name || null,
    posted_date: parseDate(samOpp.postedDate)!,
    response_deadline: parseDate(samOpp.responseDeadLine)!,
    archive_date: samOpp.archiveDate ? parseDate(samOpp.archiveDate) : null,
    naics_code: samOpp.naicsCode || null,
    naics_description: naicsDescription,
    place_of_performance_state: samOpp.placeOfPerformance?.state?.name || null,
    place_of_performance_city: samOpp.placeOfPerformance?.city?.name || null,
    set_aside_type: samOpp.typeOfSetAsideDescription || null,
    contract_type: null, // Would need to parse from description
    estimated_value_min: estimatedValue.min,
    estimated_value_max: estimatedValue.max,
    award_date: samOpp.award?.date ? parseDate(samOpp.award.date) : null,
    award_amount: samOpp.award?.amount ? parseFloat(samOpp.award.amount.replace(/[,$]/g, '')) || null : null,
    awardee_name: samOpp.award?.awardee?.name || null,
    awardee_duns: samOpp.award?.awardee?.ueiSAM || null,
    status: parseOpportunityStatus(samOpp),
    solicitation_number: samOpp.solicitationNumber || null,
    primary_contact_name: samOpp.pointOfContact?.[0]?.fullName || null,
    primary_contact_email: samOpp.pointOfContact?.[0]?.email || null,
    primary_contact_phone: samOpp.pointOfContact?.[0]?.phone || null,
    attachments: [], // Could be populated from resourceLinks
    additional_info: {
      organizationType: samOpp.organizationType,
      additionalInfoLink: samOpp.additionalInfoLink,
      resourceLinks: samOpp.resourceLinks || [],
      baseType: samOpp.baseType,
      archiveType: samOpp.archiveType
    },
    sam_url: samOpp.uiLink || null
  }
}

/**
 * Batch insert or update opportunities in the database
 */
export async function syncOpportunitiesToDatabase(
  opportunities: ISAMOpportunity[]
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const errors: string[] = []
  let inserted = 0
  let updated = 0
  
  for (const samOpp of opportunities) {
    try {
      const dbOpportunity = mapSAMOpportunityToDatabase(samOpp)
      
      // Check if opportunity already exists
      const { data: existing } = await supabase
        .from('opportunities')
        .select('id, updated_at')
        .eq('notice_id', samOpp.noticeId)
        .single()
      
      if (existing) {
        // Update existing opportunity
        const { error } = await supabase
          .from('opportunities')
          .update(dbOpportunity)
          .eq('notice_id', samOpp.noticeId)
        
        if (error) {
          errors.push(`Update failed for ${samOpp.noticeId}: ${error.message}`)
        } else {
          updated++
        }
      } else {
        // Insert new opportunity
        const { error } = await supabase
          .from('opportunities')
          .insert(dbOpportunity)
        
        if (error) {
          errors.push(`Insert failed for ${samOpp.noticeId}: ${error.message}`)
        } else {
          inserted++
        }
      }
    } catch (error) {
      errors.push(`Processing failed for ${samOpp.noticeId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  return { inserted, updated, errors }
}

/**
 * Get opportunities from database with filtering and optimized sorting
 */
export async function getOpportunitiesFromDatabase(filters: {
  naicsCodes?: string[]
  state?: string
  status?: 'active' | 'awarded' | 'cancelled' | 'expired'
  searchQuery?: string
  limit?: number
  offset?: number
  responseDeadlineFrom?: string
  responseDeadlineTo?: string
  companyNaicsCodes?: string[] // For match score calculation
}) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  let query = supabase
    .from('opportunities')
    .select(`
      *,
      saved_opportunities!left(id, user_id, notes, tags, is_pursuing, reminder_date)
    `, { count: 'exact' })
  
  // Apply filters
  if (filters.naicsCodes && filters.naicsCodes.length > 0) {
    query = query.in('naics_code', filters.naicsCodes)
  }
  
  if (filters.state) {
    query = query.eq('place_of_performance_state', filters.state)
  }
  
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  
  if (filters.searchQuery) {
    // Use full-text search if available, otherwise fallback to ilike
    query = query.or(`title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`)
  }
  
  if (filters.responseDeadlineFrom) {
    query = query.gte('response_deadline', filters.responseDeadlineFrom)
  }
  
  if (filters.responseDeadlineTo) {
    query = query.lte('response_deadline', filters.responseDeadlineTo)
  }
  
  // Simplify ordering - Supabase doesn't support complex CASE statements in ORDER BY
  // Sort by response deadline first (most urgent first)
  query = query.order('response_deadline', { ascending: true })
  
  // If we have company NAICS codes, we'll calculate match scores on the client side
  // This is more reliable than complex SQL ordering
  
  // Apply pagination after sorting
  if (filters.offset) {
    query = query.range(filters.offset, (filters.offset + (filters.limit || 25)) - 1)
  } else {
    query = query.limit(filters.limit || 25)
  }
  
  return query
}

/**
 * Calculate opportunity match score based on company NAICS codes
 */
export function calculateOpportunityMatch(
  opportunity: OpportunityRow,
  companyNaicsCodes: string[]
): number {
  if (!opportunity.naics_code || companyNaicsCodes.length === 0) {
    return 0
  }
  
  // Exact NAICS match
  if (companyNaicsCodes.includes(opportunity.naics_code)) {
    return 1.0
  }
  
  // Check for partial NAICS matches (same industry group)
  const oppNaicsPrefix = opportunity.naics_code.substring(0, 3)
  const hasPartialMatch = companyNaicsCodes.some(code => 
    code.substring(0, 3) === oppNaicsPrefix
  )
  
  if (hasPartialMatch) {
    return 0.7
  }
  
  // Check for broader industry sector match (same 2-digit)
  const oppSectorPrefix = opportunity.naics_code.substring(0, 2)
  const hasSectorMatch = companyNaicsCodes.some(code => 
    code.substring(0, 2) === oppSectorPrefix
  )
  
  if (hasSectorMatch) {
    return 0.4
  }
  
  return 0.1 // Low relevance but still might be interesting
}

/**
 * Format currency values for display
 */
export function formatCurrency(amount: number | null): string {
  if (!amount) return 'Not specified'
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
  
  if (amount >= 1000000) {
    return formatter.format(amount / 1000000) + 'M'
  } else if (amount >= 1000) {
    return formatter.format(amount / 1000) + 'K'
  } else {
    return formatter.format(amount)
  }
}

/**
 * Format opportunity deadline with urgency indication
 */
export function formatDeadline(deadline: string): {
  formatted: string
  daysRemaining: number
  urgency: 'high' | 'medium' | 'low' | 'expired'
} {
  const deadlineDate = new Date(deadline)
  const now = new Date()
  const diffTime = deadlineDate.getTime() - now.getTime()
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  let urgency: 'high' | 'medium' | 'low' | 'expired' = 'low'
  
  if (daysRemaining < 0) {
    urgency = 'expired'
  } else if (daysRemaining <= 3) {
    urgency = 'high'
  } else if (daysRemaining <= 7) {
    urgency = 'medium'
  }
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
  
  return {
    formatted: formatter.format(deadlineDate),
    daysRemaining,
    urgency
  }
}

/**
 * Generate SEO-friendly URL slug from opportunity title
 */
export function generateOpportunitySlug(opportunity: OpportunityRow): string {
  return `${opportunity.notice_id}-${opportunity.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)}`
}