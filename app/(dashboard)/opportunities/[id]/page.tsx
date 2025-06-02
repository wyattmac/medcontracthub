/**
 * Individual Opportunity Detail Page
 * Route: /dashboard/opportunities/[id]
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { Database } from '@/types/database.types'
import { OpportunityDetailContainer } from '@/components/dashboard/opportunities/opportunity-detail-container'

interface IOpportunityDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OpportunityDetailPage({ params }: IOpportunityDetailPageProps) {
  const { id } = await params
  const supabase = createServerComponentClient<Database>({ cookies })

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch opportunity data
  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      saved_opportunities!left(
        id,
        notes,
        tags,
        is_pursuing,
        reminder_date
      )
    `)
    .eq('id', id)
    .eq('saved_opportunities.user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching opportunity:', error)
    notFound()
  }

  if (!opportunity) {
    notFound()
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

  return (
    <OpportunityDetailContainer 
      opportunity={opportunity}
      companyNaicsCodes={companyNaicsCodes}
      userId={user.id}
    />
  )
}

// Generate metadata for SEO
export async function generateMetadata({ params }: IOpportunityDetailPageProps) {
  const { id } = await params
  const supabase = createServerComponentClient<Database>({ cookies })

  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('title, description, agency')
    .eq('id', id)
    .single()

  if (!opportunity) {
    return {
      title: 'Opportunity Not Found',
    }
  }

  return {
    title: `${opportunity.title} - ${opportunity.agency} | MedContractHub`,
    description: opportunity.description?.substring(0, 160) || `Government contract opportunity from ${opportunity.agency}`,
  }
}