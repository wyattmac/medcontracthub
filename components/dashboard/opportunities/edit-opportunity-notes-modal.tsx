/**
 * Edit Opportunity Notes Modal - Add/edit notes, tags, and tracking info
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Edit3, X, CalendarIcon, Plus, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface IEditOpportunityNotesModalProps {
  opportunityId: string
  opportunity: {
    title: string
    saved_opportunities?: Array<{
      notes: string | null
      tags: string[]
      is_pursuing: boolean
      reminder_date: string | null
    }>
  }
  trigger?: React.ReactNode
}

export function EditOpportunityNotesModal({ 
  opportunityId, 
  opportunity, 
  trigger 
}: IEditOpportunityNotesModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const savedOpportunity = opportunity.saved_opportunities?.[0]
  
  const [notes, setNotes] = useState(savedOpportunity?.notes || '')
  const [tags, setTags] = useState<string[]>(savedOpportunity?.tags || [])
  const [isPursuing, setIsPursuing] = useState(savedOpportunity?.is_pursuing || false)
  const [reminderDate, setReminderDate] = useState<Date | undefined>(
    savedOpportunity?.reminder_date ? new Date(savedOpportunity.reminder_date) : undefined
  )
  const [newTag, setNewTag] = useState('')

  // Reset form when opening modal
  useEffect(() => {
    if (open) {
      setNotes(savedOpportunity?.notes || '')
      setTags(savedOpportunity?.tags || [])
      setIsPursuing(savedOpportunity?.is_pursuing || false)
      setReminderDate(
        savedOpportunity?.reminder_date ? new Date(savedOpportunity.reminder_date) : undefined
      )
      setNewTag('')
    }
  }, [open, savedOpportunity])

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    
    try {
      // First save the opportunity if not already saved
      const response = await fetch('/api/opportunities/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId,
          action: 'save',
          notes: notes.trim() || null,
          tags,
          isPursuing,
          reminderDate: reminderDate?.toISOString() || null
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success('Notes updated successfully')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update notes')
      }
    } catch (error) {
      console.error('Error updating notes:', error)
      toast.error('An error occurred while updating notes')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="w-full">
            <Edit3 className="mr-2 h-4 w-4" />
            Edit Notes
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Opportunity Notes</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground line-clamp-2">
            {opportunity.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add your notes about this opportunity..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label>Tags</Label>
            
            {/* Existing Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add New Tag */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button 
                type="button" 
                onClick={handleAddTag}
                variant="outline" 
                size="sm"
                disabled={!newTag.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tracking Status */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="pursuing"
              checked={isPursuing}
              onCheckedChange={(checked) => setIsPursuing(checked as boolean)}
            />
            <Label 
              htmlFor="pursuing" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I am actively pursuing this opportunity
            </Label>
          </div>

          {/* Reminder Date */}
          <div className="space-y-2">
            <Label>Reminder Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !reminderDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reminderDate ? format(reminderDate, "PPP") : "Set reminder date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={reminderDate}
                  onSelect={setReminderDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
                {reminderDate && (
                  <div className="p-3 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setReminderDate(undefined)}
                      className="w-full"
                    >
                      Clear reminder
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}