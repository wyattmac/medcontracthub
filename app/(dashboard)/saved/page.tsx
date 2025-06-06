/**
 * Saved Opportunities Page
 * Route: /dashboard/saved
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Database } from '@/types/database.types'
import { SavedOpportunitiesContainer } from '@/components/dashboard/saved/saved-opportunities-container'
import { SectionErrorBoundary } from '@/components/ui/error-boundary'

export default async function SavedOpportunitiesPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient<Database>({ cookies: () => cookieStore })

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Saved Opportunities</h1>
        <p className="text-muted-foreground">
          Manage your saved opportunities, notes, and reminders
        </p>
      </div>

      <SectionErrorBoundary name="Saved Opportunities">
        <SavedOpportunitiesContainer userId={user.id} />
      </SectionErrorBoundary>
    </div>
  )
}

export const metadata = {
  title: 'Saved Opportunities | MedContractHub',
  description: 'Manage your saved government contract opportunities, notes, and tracking information.',
}