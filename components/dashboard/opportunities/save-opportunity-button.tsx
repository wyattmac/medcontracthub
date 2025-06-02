/**
 * Save Opportunity Button - Toggle save/unsave functionality
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
  showText = false
}: ISaveOpportunityButtonProps) {
  const router = useRouter()
  const [isSaved, setIsSaved] = useState(initialIsSaved)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault() // Prevent navigation if button is in a Link
    e.stopPropagation()

    setIsLoading(true)
    
    try {
      const response = await fetch('/api/opportunities/save', {
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
        toast.success(result.message)
        router.refresh() // Refresh to update the data
      } else {
        toast.error(result.error || 'Failed to save opportunity')
      }
    } catch (error) {
      console.error('Error saving opportunity:', error)
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