/**
 * Save Opportunity Button - Toggle save/unsave functionality
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCSRF } from '@/lib/hooks/useCSRF'

interface ISaveOpportunityButtonProps {
  opportunityId: string
  isSaved: boolean
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg'
  showText?: boolean
}

export function SaveOpportunityButton({ 
  opportunityId, 
  isSaved: initialIsSaved,
  variant = 'ghost',
  size = 'sm',
  showText = false,
  opportunityData
}: ISaveOpportunityButtonProps & { opportunityData?: any }) {
  const router = useRouter()
  const csrf = useCSRF()
  const [isSaved, setIsSaved] = useState(initialIsSaved)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault() // Prevent navigation if button is in a Link
    e.stopPropagation()

    // Optimistic update - immediately update UI
    const previousState = isSaved
    setIsSaved(!isSaved)
    setIsLoading(true)
    
    try {
      // Always use the real save endpoint
      const endpoint = '/api/opportunities/save'
      
      const response = await csrf.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId,
          action: previousState ? 'unsave' : 'save'
        })
      })

      const result = await response.json()

      if (response.ok) {
        // Success - show toast but don't update state (already updated optimistically)
        toast.success(result.message || (previousState ? 'Opportunity removed from saved' : 'Opportunity saved successfully'))
        
        // Refresh in background without blocking UI
        setTimeout(() => {
          router.refresh()
        }, 100)
      } else {
        // Error - revert the optimistic update
        setIsSaved(previousState)
        toast.error(result.error || 'Failed to save opportunity')
      }
    } catch (error) {
      console.error('Error saving opportunity:', error)
      // Revert the optimistic update
      setIsSaved(previousState)
      toast.error('An error occurred while saving the opportunity')
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
      className="flex items-center gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSaved ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {showText && (isSaved ? 'Saved' : 'Save')}
    </Button>
  )
}