'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { StandardOpportunityLayout } from '@/components/dashboard/opportunities/standard-opportunity-layout'
import { calculateOpportunityMatch } from '@/lib/sam-gov/utils'
import { createClient } from '@/lib/supabase/client'

interface OpportunityDetailWrapperProps {
  opportunityId: string
}

export function OpportunityDetailWrapper({ opportunityId }: OpportunityDetailWrapperProps) {
  const [opportunity, setOpportunity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userNaicsCodes, setUserNaicsCodes] = useState<string[]>(['423450', '339112']) // Default fallback
  const router = useRouter()
  const supabase = createClient()

  // Fetch user's NAICS codes for personalized matching
  useEffect(() => {
    async function fetchUserNaics() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select(`
              company_id,
              companies!inner(naics_codes)
            `)
            .eq('id', user.id)
            .single()
          
          if (profile?.companies) {
            const companyNaics = (profile.companies as Record<string, any>)?.naics_codes || []
            if (companyNaics.length > 0) {
              setUserNaicsCodes(companyNaics)
            }
          }
        }
      } catch {
        console.log('Could not fetch user NAICS codes, using defaults')
      }
    }
    
    fetchUserNaics()
  }, [supabase])

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
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: { message: errorText } }
          }
          
          if (response.status === 404) {
            setError('Opportunity not found')
            console.error('Opportunity not found:', opportunityId)
          } else {
            setError(errorData.error?.message || `Failed to load opportunity: ${response.status}`)
            console.error('API Error:', errorData)
          }
          setLoading(false)
          return
        }

        const data = await response.json()
        console.log('Opportunity data:', data)
        
        // Add match score based on user's NAICS codes
        const opportunityWithMatch = {
          ...data.opportunity,
          matchScore: calculateOpportunityMatch(data.opportunity, userNaicsCodes)
        }
        
        setOpportunity(opportunityWithMatch)
      } catch (err) {
        console.error('Error fetching opportunity:', err)
        setError(err instanceof Error ? err.message : 'Failed to load opportunity')
        setLoading(false)
      }
    }

    if (opportunityId) {
      fetchOpportunity()
    }
  }, [opportunityId, userNaicsCodes])

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
            <Button 
              onClick={() => router.push('/opportunities')} 
              variant="outline" 
              className="mt-4"
            >
              Back to Opportunities
            </Button>
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

  return (
    <StandardOpportunityLayout
      opportunity={opportunity}
    />
  )
}