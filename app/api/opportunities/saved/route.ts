/**
 * API Route: Get saved opportunities
 * GET /api/opportunities/saved
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'
import { calculateOpportunityMatch } from '@/lib/sam-gov/utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient<Database>({ cookies })
    
    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const filters = {
      isPursuing: searchParams.get('is_pursuing') === 'true' ? true : 
                  searchParams.get('is_pursuing') === 'false' ? false : undefined,
      hasReminder: searchParams.get('has_reminder') === 'true' ? true :
                   searchParams.get('has_reminder') === 'false' ? false : undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || [],
      sortBy: searchParams.get('sort_by') as 'deadline' | 'saved_date' | 'match_score' || 'deadline'
    }

    // Get user's company NAICS codes for match scoring
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        company_id,
        companies!inner(naics_codes)
      `)
      .eq('id', user.id)
      .single()

    const companyNaicsCodes = (profile?.companies as any)?.naics_codes || []

    // Build the query
    let query = supabase
      .from('saved_opportunities')
      .select(`
        *,
        opportunities!inner(
          id,
          notice_id,
          title,
          description,
          agency,
          sub_agency,
          office,
          posted_date,
          response_deadline,
          archive_date,
          naics_code,
          naics_description,
          place_of_performance_state,
          place_of_performance_city,
          set_aside_type,
          contract_type,
          estimated_value_min,
          estimated_value_max,
          award_date,
          award_amount,
          awardee_name,
          awardee_duns,
          status,
          solicitation_number,
          primary_contact_name,
          primary_contact_email,
          primary_contact_phone,
          attachments,
          additional_info,
          sam_url,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)

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
    const { data: savedOpportunities, error, count } = await query

    if (error) {
      console.error('Database query error:', error)
      return NextResponse.json(
        { error: 'Query failed' },
        { status: 500 }
      )
    }

    // Process and enhance data
    const enhancedOpportunities = (savedOpportunities || []).map(savedOpp => {
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
    enhancedOpportunities.sort((a, b) => {
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
    const allTags = enhancedOpportunities.flatMap(opp => opp.tags || [])
    const uniqueTags = [...new Set(allTags)].sort()

    // Count reminders due soon (next 7 days)
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const remindersDueSoon = enhancedOpportunities.filter(opp => {
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
        pursuing: enhancedOpportunities.filter(opp => opp.is_pursuing).length,
        withReminders: enhancedOpportunities.filter(opp => opp.reminder_date).length,
        expiringSoon: enhancedOpportunities.filter(opp => {
          const deadline = new Date(opp.opportunity.response_deadline)
          return deadline >= now && deadline <= nextWeek
        }).length
      }
    })

  } catch (error) {
    console.error('Get saved opportunities error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}