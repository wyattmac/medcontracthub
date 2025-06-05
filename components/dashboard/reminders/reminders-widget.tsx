/**
 * Reminders Widget - Show upcoming reminders and deadlines
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  ArrowRight,
  Bell
} from 'lucide-react'
import { format, isToday, isTomorrow, formatDistanceToNow } from 'date-fns'

export function RemindersWidget() {
  const { data: reminders, isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const response = await fetch('/api/reminders')
      if (!response.ok) {
        throw new Error('Failed to fetch reminders')
      }
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
  })

  if (isLoading) {
    return <RemindersWidgetSkeleton />
  }

  const upcomingReminders = reminders?.upcomingReminders || []
  const expiringOpportunities = reminders?.expiringOpportunities || []

  const totalCount = upcomingReminders.length + expiringOpportunities.length

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Reminders & Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No upcoming reminders or deadlines
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Reminders & Deadlines
          </div>
          <Badge variant="secondary">{totalCount}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Upcoming Reminders */}
        {upcomingReminders.map((reminder: any) => (
          <ReminderItem key={reminder.id} reminder={reminder} type="reminder" />
        ))}

        {/* Expiring Opportunities */}
        {expiringOpportunities.map((opportunity: any) => (
          <ReminderItem key={opportunity.id} reminder={opportunity} type="deadline" />
        ))}

        {/* View All Link */}
        <div className="pt-3 border-t">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/saved">
              View All Saved Opportunities
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ReminderItem({ reminder, type }: { reminder: any, type: 'reminder' | 'deadline' }) {
  const isReminderType = type === 'reminder'
  const date = new Date(isReminderType ? reminder.reminder_date : reminder.response_deadline)
  const title = isReminderType ? reminder.opportunities?.title : reminder.title
  const opportunityId = isReminderType ? reminder.opportunities?.id : reminder.id
  
  const getTimeInfo = () => {
    if (isToday(date)) {
      return { label: 'Today', variant: 'destructive' as const, urgent: true }
    } else if (isTomorrow(date)) {
      return { label: 'Tomorrow', variant: 'destructive' as const, urgent: true }
    } else {
      const distance = formatDistanceToNow(date, { addSuffix: true })
      const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      
      if (days <= 3) {
        return { label: distance, variant: 'destructive' as const, urgent: true }
      } else if (days <= 7) {
        return { label: distance, variant: 'secondary' as const, urgent: false }
      } else {
        return { label: distance, variant: 'outline' as const, urgent: false }
      }
    }
  }

  const timeInfo = getTimeInfo()
  
  return (
    <Link 
      href={`/opportunities/${opportunityId}`}
      className="block hover:bg-gray-50 rounded-lg p-3 -m-3 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {timeInfo.urgent ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : (
            <Clock className="h-4 w-4 text-orange-500" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={timeInfo.variant} className="text-xs">
              {isReminderType ? 'Reminder' : 'Deadline'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {timeInfo.label}
            </Badge>
          </div>
          
          <p className="text-sm font-medium line-clamp-2 mb-1">
            {title}
          </p>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{format(date, 'PPp')}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function RemindersWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Reminders & Deadlines
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3">
            <div className="w-4 h-4 bg-muted animate-pulse rounded" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="w-16 h-4 bg-muted animate-pulse rounded" />
                <div className="w-20 h-4 bg-muted animate-pulse rounded" />
              </div>
              <div className="w-3/4 h-4 bg-muted animate-pulse rounded" />
              <div className="w-1/2 h-3 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}