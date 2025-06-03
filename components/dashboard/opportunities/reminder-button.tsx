/**
 * Reminder Button Component
 * Allows users to set up deadline reminders for opportunities
 */

'use client'

import React, { useState } from 'react'
import { Bell, BellRing, Clock, Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'
import { format, parseISO, differenceInDays } from 'date-fns'

interface IReminderButtonProps {
  opportunityId: string
  opportunityTitle: string
  deadline?: string
  isCompact?: boolean
  className?: string
}

interface IReminderOption {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  reminderType: 'immediate' | '24_hours' | '3_days' | '7_days'
  disabled?: boolean
}

export function ReminderButton({
  opportunityId,
  opportunityTitle,
  deadline,
  isCompact = false,
  className = ''
}: IReminderButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState<IReminderOption | null>(null)
  const { toast } = useToast()

  // Calculate days remaining if deadline exists
  const daysRemaining = deadline ? differenceInDays(parseISO(deadline), new Date()) : null
  const hasDeadlinePassed = daysRemaining !== null && daysRemaining < 0

  // Define reminder options based on deadline
  const reminderOptions: IReminderOption[] = [
    {
      id: 'immediate',
      label: 'Send Now',
      description: 'Send reminder email immediately',
      icon: <Send className="h-4 w-4" />,
      reminderType: 'immediate',
    },
    {
      id: '24_hours',
      label: '24 Hours Before',
      description: 'Remind me 1 day before deadline',
      icon: <Clock className="h-4 w-4" />,
      reminderType: '24_hours',
      disabled: daysRemaining !== null && daysRemaining <= 1,
    },
    {
      id: '3_days',
      label: '3 Days Before',
      description: 'Remind me 3 days before deadline',
      icon: <Bell className="h-4 w-4" />,
      reminderType: '3_days',
      disabled: daysRemaining !== null && daysRemaining <= 3,
    },
    {
      id: '7_days',
      label: '7 Days Before',
      description: 'Remind me 1 week before deadline',
      icon: <BellRing className="h-4 w-4" />,
      reminderType: '7_days',
      disabled: daysRemaining !== null && daysRemaining <= 7,
    },
  ]

  const handleReminderClick = (option: IReminderOption) => {
    if (option.reminderType === 'immediate') {
      // Send immediate reminder
      sendReminder(option.reminderType)
    } else {
      // Show confirmation dialog for scheduled reminders
      setSelectedReminder(option)
      setIsDialogOpen(true)
    }
  }

  const sendReminder = async (reminderType: string) => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/emails/reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          opportunityId,
          reminderType,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send reminder')
      }

      const result = await response.json()

      toast({
        title: 'Reminder Sent!',
        description: reminderType === 'immediate' 
          ? 'Email reminder has been sent to your inbox'
          : `Reminder scheduled for ${result.daysRemaining} days before deadline`,
        duration: 5000,
      })

      setIsDialogOpen(false)
      setSelectedReminder(null)

    } catch (error) {
      console.error('Failed to send reminder:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send reminder',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (hasDeadlinePassed) {
    return (
      <Button variant="outline" size={isCompact ? "sm" : "default"} disabled className={className}>
        <Clock className="h-4 w-4 mr-2" />
        {isCompact ? 'Expired' : 'Deadline Passed'}
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={isCompact ? "sm" : "default"} className={className}>
            <Bell className="h-4 w-4 mr-2" />
            {isCompact ? 'Remind' : 'Set Reminder'}
            {daysRemaining !== null && daysRemaining <= 7 && (
              <Badge variant="secondary" className="ml-2">
                {daysRemaining}d
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Reminders
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {deadline && (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              Deadline: {format(parseISO(deadline), 'MMM d, yyyy')}
              {daysRemaining !== null && (
                <span className="block">
                  {daysRemaining === 0 ? 'Due today' : 
                   daysRemaining === 1 ? '1 day remaining' :
                   `${daysRemaining} days remaining`}
                </span>
              )}
            </div>
          )}
          <DropdownMenuSeparator />

          {reminderOptions.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onClick={() => handleReminderClick(option)}
              disabled={option.disabled || isLoading}
              className="flex items-start gap-2 py-3"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                {option.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-muted-foreground">
                  {option.description}
                </div>
                {option.disabled && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    Too late
                  </Badge>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Email Reminder</DialogTitle>
            <DialogDescription>
              Set up an email reminder for this opportunity deadline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium">{opportunityTitle}</h4>
              {deadline && (
                <p className="text-sm text-muted-foreground mt-1">
                  Deadline: {format(parseISO(deadline), 'EEEE, MMMM d, yyyy')}
                </p>
              )}
            </div>

            {selectedReminder && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  {selectedReminder.icon}
                </div>
                <div>
                  <div className="font-medium">{selectedReminder.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedReminder.description}
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              📧 The reminder will be sent to your registered email address.
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => selectedReminder && sendReminder(selectedReminder.reminderType)}
              disabled={isLoading}
            >
              {isLoading ? 'Scheduling...' : 'Schedule Reminder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ReminderButton