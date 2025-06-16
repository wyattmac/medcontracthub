/**
 * Save Opportunity Button V2 - Production Ready
 * Works in both development (localStorage) and production (Supabase)
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCSRF } from '@/lib/hooks/useCSRF'
import { useAuth } from '@/lib/hooks/useAuth'
import { mockSavedOpportunitiesStore } from '@/lib/mock/saved-opportunities-store'

interface ISaveOpportunityButtonProps {
  opportunityId: string
  isSaved: boolean
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg'
  showText?: boolean
  opportunityData?: any
}

export function SaveOpportunityButton({ 
  opportunityId, 
  isSaved: initialIsSaved,
  variant = 'ghost',
  size = 'sm',
  showText = false,
  opportunityData
}: ISaveOpportunityButtonProps) {
  const router = useRouter()
  const csrf = useCSRF()
  const { user, isDevelopment } = useAuth()
  const [isSaved, setIsSaved] = useState(initialIsSaved)
  const [isLoading, setIsLoading] = useState(false)

  // Check saved status on mount
  useEffect(() => {
    if (!user?.id) return

    if (isDevelopment && typeof window !== 'undefined') {
      // Development: Check localStorage
      const saved = mockSavedOpportunitiesStore.isSaved(user.id, opportunityId)
      setIsSaved(saved)
    } else {
      // Production: Use the initial value from the server
      // The server already includes isSaved status in the opportunity data
      setIsSaved(initialIsSaved)
    }
  }, [user?.id, opportunityId, isDevelopment, initialIsSaved])

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      toast.error('Please log in to save opportunities')
      router.push('/login')
      return
    }

    setIsLoading(true)
    
    try {
      if (isDevelopment) {
        // Development: Update localStorage and call simple endpoint
        const endpoint = '/api/opportunities/save-dev'
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opportunityId,
            action: isSaved ? 'unsave' : 'save'
          })
        })

        if (response.ok) {
          // Update localStorage
          if (isSaved) {
            mockSavedOpportunitiesStore.unsave(user.id, opportunityId)
          } else {
            mockSavedOpportunitiesStore.save(user.id, opportunityId, opportunityData || { id: opportunityId })
          }
          
          setIsSaved(!isSaved)
          toast.success(isSaved ? 'Removed from saved' : 'Saved successfully')
          router.refresh()
        } else {
          toast.error('Failed to save opportunity')
        }
      } else {
        // Production: Use real API with CSRF protection
        const response = await csrf.fetch('/api/opportunities/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opportunityId,
            action: isSaved ? 'unsave' : 'save'
          })
        })

        const result = await response.json()

        if (response.ok) {
          setIsSaved(!isSaved)
          toast.success(result.message || (isSaved ? 'Removed from saved' : 'Saved successfully'))
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to save opportunity')
        }
      }
    } catch (error) {
      console.error('Error saving opportunity:', error)
      toast.error('An error occurred while saving')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button 
      variant={isSaved ? 'default' : variant} 
      size={size}
      onClick={handleSave}
      disabled={isLoading}
      className={cn(
        "transition-all duration-200",
        isSaved && "bg-primary hover:bg-primary/90"
      )}
      title={isSaved ? "Remove from saved" : "Save opportunity"}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {isSaved ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {showText && (
            <span className="ml-2">
              {isSaved ? 'Saved' : 'Save'}
            </span>
          )}
        </>
      )}
    </Button>
  )
}

// Helper function
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}