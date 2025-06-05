'use client'

import { useEffect, useState } from 'react'
import { notFound, useRouter } from 'next/navigation'
import { OpportunityDetailContainer } from '@/components/dashboard/opportunities/opportunity-detail-container'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface OpportunityDetailWrapperProps {
  opportunityId: string
}

export function OpportunityDetailWrapper({ opportunityId }: OpportunityDetailWrapperProps) {
  const [opportunity, setOpportunity] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchOpportunity() {
      try {
        setLoading(true)
        console.log('Fetching opportunity:', opportunityId)
        
        const response = await fetch(`/api/opportunities/${opportunityId}`, {
          credentials: 'include', // Include cookies for authentication
          headers: {
            'Content-Type': 'application/json',
          }
        })
        console.log('Response status:', response.status)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Error response:', errorText)
          
          let errorMessage = `Failed to fetch opportunity (${response.status})`
          try {
            const errorData = JSON.parse(errorText)
            errorMessage = errorData.error?.message || errorData.message || errorMessage
          } catch {
            // If not JSON, use the text
            errorMessage = errorText || errorMessage
          }
          
          if (response.status === 404) {
            notFound()
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()
        console.log('Opportunity data:', data)
        setOpportunity(data.opportunity)
      } catch (err) {
        console.error('Error fetching opportunity:', err)
        setError(err instanceof Error ? err.message : 'Failed to load opportunity')
      } finally {
        setLoading(false)
      }
    }

    if (opportunityId) {
      fetchOpportunity()
    }
  }, [opportunityId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto mt-8">
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold">Error loading opportunity</p>
            <p className="text-sm">{error}</p>
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">Debug info:</p>
              <pre className="text-xs bg-black/10 p-2 rounded overflow-auto">
                Opportunity ID: {opportunityId}
                URL: /api/opportunities/{opportunityId}
                Check browser console for more details
              </pre>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (!opportunity) {
    return (
      <Alert>
        <AlertDescription>Opportunity not found</AlertDescription>
      </Alert>
    )
  }

  if (!user || !userProfile) {
    return (
      <Alert>
        <AlertDescription>Please log in to view opportunity details</AlertDescription>
      </Alert>
    )
  }

  // Get company NAICS codes from user profile
  const companyNaicsCodes = userProfile.naics_codes || []

  return (
    <OpportunityDetailContainer
      opportunity={opportunity}
      companyNaicsCodes={companyNaicsCodes}
      userId={user.id}
    />
  )
}