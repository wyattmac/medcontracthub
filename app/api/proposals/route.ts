import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('proposals')
      .select(`
        *,
        opportunities (
          id,
          title,
          solicitation_number,
          response_deadline,
          agency
        ),
        proposal_sections (
          id,
          section_type,
          title,
          word_count
        )
      `)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: proposals, error } = await query

    if (error) {
      console.error('Error fetching proposals:', error)
      return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 })
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', profile.company_id)

    if (status) {
      countQuery = countQuery.eq('status', status)
    }

    const { count } = await countQuery

    return NextResponse.json({
      proposals,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('Unexpected error in proposals GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      opportunity_id,
      title,
      solicitation_number,
      submission_deadline,
      total_proposed_price,
      proposal_summary,
      win_probability,
      notes,
      tags,
      sections
    } = body

    // Validate required fields
    if (!opportunity_id || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: opportunity_id, title' },
        { status: 400 }
      )
    }

    // Verify opportunity exists and user has access
    const { data: opportunity } = await supabase
      .from('opportunities')
      .select('id')
      .eq('id', opportunity_id)
      .single()

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    // Create proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .insert({
        opportunity_id,
        company_id: profile.company_id,
        created_by: user.id,
        title,
        solicitation_number,
        submission_deadline: submission_deadline ? new Date(submission_deadline).toISOString() : null,
        total_proposed_price: total_proposed_price ? parseFloat(total_proposed_price) : null,
        proposal_summary,
        win_probability: win_probability ? parseFloat(win_probability) : null,
        notes,
        tags: tags || []
      })
      .select()
      .single()

    if (proposalError) {
      console.error('Error creating proposal:', proposalError)
      return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 })
    }

    // Create default sections if provided
    if (sections && Array.isArray(sections) && sections.length > 0) {
      const sectionsToInsert = sections.map((section, index) => ({
        proposal_id: proposal.id,
        section_type: section.section_type,
        title: section.title,
        content: section.content || '',
        sort_order: index,
        is_required: section.is_required || false,
        max_pages: section.max_pages || null
      }))

      const { error: sectionsError } = await supabase
        .from('proposal_sections')
        .insert(sectionsToInsert)

      if (sectionsError) {
        console.error('Error creating proposal sections:', sectionsError)
        // Don't fail the whole request, just log the error
      }
    }

    return NextResponse.json({ proposal }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in proposals POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}