/**
 * API Route: Get saved opportunities
 * GET /api/opportunities/saved
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'
import { calculateOpportunityMatch } from '@/lib/sam-gov/utils'
import { DatabaseError } from '@/lib/errors/types'

// Query parameter validation schema
const savedOpportunitiesQuerySchema = z.object({
  is_pursuing: z.enum(['true', 'false']).optional(),
  has_reminder: z.enum(['true', 'false']).optional(),
  tags: z.string().optional(),
  sort_by: z.enum(['deadline', 'saved_date', 'match_score']).optional().default('deadline')
})

export const GET = enhancedRouteHandler.GET(
  async ({ user, supabase, sanitizedQuery }) => {
    // Parse query parameters from sanitized query
    const filters = {
      isPursuing: sanitizedQuery.is_pursuing === 'true' ? true : 
                  sanitizedQuery.is_pursuing === 'false' ? false : undefined,
      hasReminder: sanitizedQuery.has_reminder === 'true' ? true :
                   sanitizedQuery.has_reminder === 'false' ? false : undefined,
      tags: sanitizedQuery.tags?.split(',').filter(Boolean) || [],
      sortBy: sanitizedQuery.sort_by || 'deadline'
    }

    // In development without auth, use a valid UUID mock user ID
    const userId = user?.id || (process.env.NODE_ENV === 'development' ? '00000000-0000-0000-0000-000000000000' : null)
    
    if (!userId) {
      throw new DatabaseError('User ID not found')
    }

    // Get user's company NAICS codes for match scoring
    let companyNaicsCodes = ['339112', '423450', '621999'] // Default medical NAICS codes
    
    if (user?.id) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          company_id,
          companies!inner(naics_codes)
        `)
        .eq('id', user.id)
        .single()

      if (!profileError && profile) {
        companyNaicsCodes = (profile?.companies as any)?.naics_codes || companyNaicsCodes
      }
    }

    // Build the query - use simpler join syntax
    let query = supabase
      .from('saved_opportunities')
      .select(`
        *,
        opportunities (*)
      `)
      .eq('user_id', userId)

    // Apply filters
    if (filters.isPursuing !== undefined) {
      query = query.eq('is_pursuing', filters.isPursuing)
    }

    if (filters.hasReminder !== undefined) {
      if (filters.hasReminder) {
        query = query.not('reminder_date', 'is', null)
      } else {
        query = query.is('reminder_date', null)
      }
    }

    if (filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags)
    }

    // Execute query
    const { data: savedOpportunities, error } = await query

    if (error) {
      console.error('Saved opportunities query error:', error)
      console.error('Query details:', { userId, filters })
      throw new DatabaseError('Failed to fetch saved opportunities', error)
    }

    // Process and enhance data
    const enhancedOpportunities = (savedOpportunities || []).map((savedOpp: any) => {
      const opportunity = savedOpp.opportunities as any
      const matchScore = calculateOpportunityMatch(opportunity, companyNaicsCodes)
      
      return {
        ...savedOpp,
        opportunity: {
          ...opportunity,
          matchScore
        }
      }
    })

    // Sort based on the requested criteria
    enhancedOpportunities.sort((a: any, b: any) => {
      switch (filters.sortBy) {
        case 'deadline':
          return new Date(a.opportunity.response_deadline).getTime() - 
                 new Date(b.opportunity.response_deadline).getTime()
        case 'saved_date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'match_score':
          return b.opportunity.matchScore - a.opportunity.matchScore
        default:
          return 0
      }
    })

    // Get unique tags for filter options
    const allTags = enhancedOpportunities.flatMap((opp: any) => opp.tags || [])
    const uniqueTags = Array.from(new Set(allTags)).sort()

    // Count reminders due soon (next 7 days)
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const remindersDueSoon = enhancedOpportunities.filter((opp: any) => {
      if (!opp.reminder_date) return false
      const reminderDate = new Date(opp.reminder_date)
      return reminderDate >= now && reminderDate <= nextWeek
    }).length

    return NextResponse.json({
      opportunities: enhancedOpportunities,
      totalCount: enhancedOpportunities.length,
      availableTags: uniqueTags,
      remindersDueSoon,
      stats: {
        total: enhancedOpportunities.length,
        pursuing: enhancedOpportunities.filter((opp: any) => opp.is_pursuing).length,
        withReminders: enhancedOpportunities.filter((opp: any) => opp.reminder_date).length,
        expiringSoon: enhancedOpportunities.filter((opp: any) => {
          const deadline = new Date(opp.opportunity.response_deadline)
          return deadline >= now && deadline <= nextWeek
        }).length
      }
    })
  },
  {
    requireAuth: process.env.NODE_ENV === 'production' && process.env.DEVELOPMENT_AUTH_BYPASS !== 'true', // Disable auth in development
    validateQuery: savedOpportunitiesQuerySchema,
    rateLimit: 'api'
  }
)