import * as cron from 'node-cron';
import { config } from '../config';
import { logger } from '../utils/logger';
import { QueueManager } from '../queues/QueueManager';
import { createClient } from '@supabase/supabase-js';
import { differenceInDays, format, subDays } from 'date-fns';

export class SchedulerService {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private queueManager: QueueManager;
  private supabase: any;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
    this.supabase = createClient(
      config.database.supabaseUrl,
      config.database.supabaseServiceKey
    );
  }

  async start(): Promise<void> {
    logger.info('Starting scheduler service...');

    // Email reminders
    if (config.scheduledJobs.emailReminders.enabled) {
      this.scheduleEmailReminders();
    }

    // SAM.gov sync
    if (config.scheduledJobs.samGovSync.enabled) {
      this.scheduleSamGovSync();
    }

    // Data cleanup
    if (config.scheduledJobs.dataCleanup.enabled) {
      this.scheduleDataCleanup();
    }

    // Report generation
    if (config.scheduledJobs.reportGeneration.enabled) {
      this.scheduleReportGeneration();
    }

    logger.info({ 
      scheduledJobs: Array.from(this.tasks.keys()) 
    }, 'Scheduler service started');
  }

  stop(): void {
    logger.info('Stopping scheduler service...');
    
    for (const [name, task] of this.tasks) {
      task.stop();
      logger.info({ job: name }, 'Stopped scheduled job');
    }
    
    this.tasks.clear();
  }

  private scheduleEmailReminders(): void {
    const task = cron.schedule(
      config.scheduledJobs.emailReminders.cron,
      async () => {
        logger.info('Running email reminders job');
        
        try {
          // Find opportunities with upcoming deadlines
          const upcomingDeadlines = await this.findUpcomingDeadlines();
          
          // Group by user
          const remindersByUser = this.groupRemindersByUser(upcomingDeadlines);
          
          // Queue email jobs
          for (const [userId, opportunities] of Object.entries(remindersByUser)) {
            await this.queueManager.addJob('email', 'send-reminder', {
              type: 'opportunity-reminder',
              data: {
                userId,
                email: (opportunities as any)[0].user_email,
                opportunities: (opportunities as any).map((opp: any) => ({
                  id: opp.id,
                  title: opp.title,
                  agency: opp.agency,
                  responseDeadline: opp.response_deadline,
                  daysUntilDeadline: differenceInDays(
                    new Date(opp.response_deadline),
                    new Date()
                  ),
                })),
              },
            });
          }
          
          logger.info({ 
            userCount: Object.keys(remindersByUser).length 
          }, 'Queued email reminder jobs');
          
        } catch (error) {
          logger.error({ error }, 'Email reminders job failed');
        }
      },
      {
        scheduled: true,
        timezone: 'America/New_York',
      }
    );

    this.tasks.set('email-reminders', task);
    logger.info({ 
      cron: config.scheduledJobs.emailReminders.cron 
    }, 'Scheduled email reminders');
  }

  private scheduleSamGovSync(): void {
    const task = cron.schedule(
      config.scheduledJobs.samGovSync.cron,
      async () => {
        logger.info('Running SAM.gov sync job');
        
        try {
          // Queue sync job
          await this.queueManager.addJob('sync', 'sam-gov-sync', {
            type: 'sam-gov-opportunities',
            data: {
              fullSync: false,
              dateRange: {
                start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
                end: format(new Date(), 'yyyy-MM-dd'),
              },
            },
          });
          
          logger.info('Queued SAM.gov sync job');
          
        } catch (error) {
          logger.error({ error }, 'SAM.gov sync job failed');
        }
      },
      {
        scheduled: true,
        timezone: 'America/New_York',
      }
    );

    this.tasks.set('sam-gov-sync', task);
    logger.info({ 
      cron: config.scheduledJobs.samGovSync.cron 
    }, 'Scheduled SAM.gov sync');
  }

  private scheduleDataCleanup(): void {
    const task = cron.schedule(
      config.scheduledJobs.dataCleanup.cron,
      async () => {
        logger.info('Running data cleanup job');
        
        try {
          // Queue cleanup job
          await this.queueManager.addJob('sync', 'data-cleanup', {
            type: 'cleanup-old-data',
            data: {
              tables: [
                'sync_logs',
                'email_logs',
                'job_logs',
                'temp_documents',
              ],
              retentionDays: config.scheduledJobs.dataCleanup.retentionDays,
              dryRun: false,
            },
          });
          
          logger.info('Queued data cleanup job');
          
        } catch (error) {
          logger.error({ error }, 'Data cleanup job failed');
        }
      },
      {
        scheduled: true,
        timezone: 'America/New_York',
      }
    );

    this.tasks.set('data-cleanup', task);
    logger.info({ 
      cron: config.scheduledJobs.dataCleanup.cron 
    }, 'Scheduled data cleanup');
  }

  private scheduleReportGeneration(): void {
    const task = cron.schedule(
      config.scheduledJobs.reportGeneration.cron,
      async () => {
        logger.info('Running report generation job');
        
        try {
          // Get active users
          const activeUsers = await this.getActiveUsers();
          
          // Queue weekly reports for active users
          for (const user of activeUsers) {
            await this.queueManager.addJob('document', 'generate-report', {
              type: 'generate-report',
              data: {
                userId: user.id,
                reportType: 'analytics',
                format: 'pdf',
                dateRange: {
                  start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
                  end: format(new Date(), 'yyyy-MM-dd'),
                },
              },
            });
            
            // Also send weekly summary email
            const stats = await this.getUserWeeklyStats(user.id);
            const topOpportunities = await this.getUserTopOpportunities(user.id);
            
            await this.queueManager.addJob('email', 'send-summary', {
              type: 'weekly-summary',
              data: {
                userId: user.id,
                email: user.email,
                stats,
                topOpportunities,
              },
            });
          }
          
          logger.info({ 
            userCount: activeUsers.length 
          }, 'Queued weekly reports');
          
        } catch (error) {
          logger.error({ error }, 'Report generation job failed');
        }
      },
      {
        scheduled: true,
        timezone: 'America/New_York',
      }
    );

    this.tasks.set('report-generation', task);
    logger.info({ 
      cron: config.scheduledJobs.reportGeneration.cron 
    }, 'Scheduled report generation');
  }

  // Helper methods
  private async findUpcomingDeadlines(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('saved_opportunities')
      .select(`
        *,
        opportunities!inner(
          id,
          title,
          agency,
          response_deadline
        ),
        users!inner(
          id,
          email
        )
      `)
      .gte('opportunities.response_deadline', new Date().toISOString())
      .lte('opportunities.response_deadline', 
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      .eq('reminder_enabled', true);

    if (error) {
      logger.error({ error }, 'Failed to find upcoming deadlines');
      return [];
    }

    return data || [];
  }

  private groupRemindersByUser(opportunities: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    opportunities.forEach(opp => {
      const userId = opp.user_id;
      if (!grouped[userId]) {
        grouped[userId] = [];
      }
      grouped[userId].push({
        ...opp.opportunities,
        user_email: opp.users.email,
      });
    });
    
    return grouped;
  }

  private async getActiveUsers(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, email')
      .eq('active', true)
      .eq('email_preferences->weekly_summary', true)
      .gte('last_activity', format(subDays(new Date(), 30), 'yyyy-MM-dd'));

    if (error) {
      logger.error({ error }, 'Failed to get active users');
      return [];
    }

    return data || [];
  }

  private async getUserWeeklyStats(userId: string): Promise<any> {
    const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    
    // Get new opportunities
    const { count: newOpportunities } = await this.supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('posted_date', weekAgo);

    // Get submitted proposals
    const { count: proposalsSubmitted } = await this.supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('submitted_at', weekAgo);

    // Get upcoming deadlines
    const { count: upcomingDeadlines } = await this.supabase
      .from('saved_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('opportunities.response_deadline', new Date().toISOString())
      .lte('opportunities.response_deadline', 
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      );

    return {
      newOpportunities: newOpportunities || 0,
      proposalsSubmitted: proposalsSubmitted || 0,
      upcomingDeadlines: upcomingDeadlines || 0,
    };
  }

  private async getUserTopOpportunities(userId: string): Promise<any[]> {
    const { data } = await this.supabase
      .from('opportunities')
      .select('id, title, agency, award_amount')
      .order('posted_date', { ascending: false })
      .limit(5);

    return data?.map(opp => ({
      id: opp.id,
      title: opp.title,
      agency: opp.agency,
      value: opp.award_amount ? `$${Number(opp.award_amount).toLocaleString()}` : undefined,
    })) || [];
  }
}