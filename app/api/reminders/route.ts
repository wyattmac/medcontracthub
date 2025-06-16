/**
 * API Route: Get reminders and upcoming deadlines
 * GET /api/reminders
 */

import { NextResponse } from 'next/server'
import { routeHandler } from '@/lib/api/route-handler-next15'

export const GET = routeHandler.GET(
  async ({ user, supabase }) => {
    const now = new Date()
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Get saved opportunities with upcoming reminders
    const { data: upcomingReminders, error: remindersError } = await supabase
      .from('saved_opportunities')
      .select(`
        id,
        reminder_date,
        notes,
        tags,
        is_pursuing,
        opportunities!inner(
          id,
          title,
          agency,
          response_deadline,
          status
        )
      `)
      .eq('user_id', user.id)
      .not('reminder_date', 'is', null)
      .gte('reminder_date', now.toISOString())
      .lte('reminder_date', next30Days.toISOString())
      .order('reminder_date', { ascending: true })

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError)
      return NextResponse.json(
        { error: 'Failed to fetch reminders' },
        { status: 500 }
      )
    }

    // Get active opportunities with deadlines in the next 14 days
    const next14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    
    const { data: expiringOpportunities, error: expiringError } = await supabase
      .from('opportunities')
      .select(`
        id,
        title,
        agency,
        response_deadline,
        status,
        saved_opportunities!left(
          id,
          user_id,
          is_pursuing
        )
      `)
      .eq('status', 'active')
      .gte('response_deadline', now.toISOString())
      .lte('response_deadline', next14Days.toISOString())
      .eq('saved_opportunities.user_id', user.id)
      .order('response_deadline', { ascending: true })
      .limit(10)

    if (expiringError) {
      console.error('Error fetching expiring opportunities:', expiringError)
      return NextResponse.json(
        { error: 'Failed to fetch expiring opportunities' },
        { status: 500 }
      )
    }

    // Filter to only include saved opportunities that are being pursued
    const filteredExpiringOpportunities = (expiringOpportunities || []).filter((opp: any) => {
      const savedOpp = opp.saved_opportunities as any
      return savedOpp && savedOpp.length > 0 && savedOpp[0].is_pursuing
    })

    // Get counts for different time periods
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const todayReminders = (upcomingReminders || []).filter((r: any) => 
      new Date(r.reminder_date!) <= today
    ).length

    const next7DaysReminders = (upcomingReminders || []).filter((r: any) => {
      const reminderDate = new Date(r.reminder_date!)
      return reminderDate > today && reminderDate <= next7Days
    }).length

    const todayDeadlines = filteredExpiringOpportunities.filter((opp: any) => 
      new Date(opp.response_deadline) <= today
    ).length

    const next7DaysDeadlines = filteredExpiringOpportunities.filter((opp: any) => {
      const deadline = new Date(opp.response_deadline)
      return deadline > today && deadline <= next7Days
    }).length

    return NextResponse.json({
      upcomingReminders: upcomingReminders || [],
      expiringOpportunities: filteredExpiringOpportunities,
      stats: {
        todayReminders,
        next7DaysReminders,
        todayDeadlines,
        next7DaysDeadlines,
        totalUpcoming: (upcomingReminders?.length || 0) + filteredExpiringOpportunities.length
      }
    })
  },
  { requireAuth: true }
)