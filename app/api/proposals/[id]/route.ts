import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get proposal with related data
    const { data: proposal, error } = await supabase
      .from('proposals')
      .select(`
        *,
        opportunities (
          id,
          title,
          solicitation_number,
          response_deadline,
          agency,
          description,
          naics_code,
          naics_description,
          estimated_value_min,
          estimated_value_max,
          sam_url
        ),
        proposal_sections (
          id,
          section_type,
          title,
          content,
          word_count,
          sort_order,
          is_required,
          max_pages,
          ai_generated,
          last_edited_by,
          created_at,
          updated_at
        ),
        proposal_attachments (
          id,
          file_name,
          file_path,
          file_size,
          file_type,
          description,
          is_required,
          created_at
        ),
        proposal_collaborators (
          id,
          user_id,
          role,
          permissions,
          profiles (
            full_name,
            email
          )
        )
      `)
      .eq('id', id as any)
      .single()

    if (error) {
      console.error('Error fetching proposal:', error)
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    return NextResponse.json({ proposal })

  } catch (error) {
    console.error('Unexpected error in proposal GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      status,
      solicitation_number,
      submission_deadline,
      total_proposed_price,
      proposal_summary,
      win_probability,
      notes,
      tags
    } = body

    // Update proposal
    const { data: proposal, error } = await (supabase as any)
      .from('proposals')
      .update({
        title,
        status,
        solicitation_number,
        submission_deadline: submission_deadline ? new Date(submission_deadline).toISOString() : null,
        total_proposed_price: total_proposed_price ? parseFloat(total_proposed_price) : null,
        proposal_summary,
        win_probability: win_probability ? parseFloat(win_probability) : null,
        notes,
        tags: tags || []
      })
      .eq('id', id as any)
      .select()
      .single()

    if (error) {
      console.error('Error updating proposal:', error)
      return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
    }

    return NextResponse.json({ proposal })

  } catch (error) {
    console.error('Unexpected error in proposal PUT:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete proposal (cascade will handle related data)
    const { error } = await supabase
      .from('proposals')
      .delete()
      .eq('id', id as any)

    if (error) {
      console.error('Error deleting proposal:', error)
      return NextResponse.json({ error: 'Failed to delete proposal' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unexpected error in proposal DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}