import { Job } from 'bullmq';
import sgMail from '@sendgrid/mail';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { config } from '../config';
import { logger } from '../utils/logger';
import { emailsSent, recordJobMetrics } from '../utils/metrics';
import { format, differenceInDays } from 'date-fns';

// Email job schemas
export const EmailJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('opportunity-reminder'),
    data: z.object({
      userId: z.string(),
      email: z.string(),
      opportunities: z.array(z.object({
        id: z.string(),
        title: z.string(),
        agency: z.string(),
        responseDeadline: z.string(),
        daysUntilDeadline: z.number(),
      })),
    }),
  }),
  z.object({
    type: z.literal('welcome'),
    data: z.object({
      userId: z.string(),
      email: z.string(),
      name: z.string(),
    }),
  }),
  z.object({
    type: z.literal('proposal-submitted'),
    data: z.object({
      userId: z.string(),
      email: z.string(),
      proposalId: z.string(),
      opportunityTitle: z.string(),
      submittedAt: z.string(),
    }),
  }),
  z.object({
    type: z.literal('weekly-summary'),
    data: z.object({
      userId: z.string(),
      email: z.string(),
      stats: z.object({
        newOpportunities: z.number(),
        proposalsSubmitted: z.number(),
        upcomingDeadlines: z.number(),
      }),
      topOpportunities: z.array(z.object({
        id: z.string(),
        title: z.string(),
        agency: z.string(),
        value: z.string().optional(),
      })),
    }),
  }),
]);

export type EmailJob = z.infer<typeof EmailJobSchema>;

// Initialize email provider
if (config.email.provider === 'sendgrid' && config.email.sendgrid.apiKey) {
  sgMail.setApiKey(config.email.sendgrid.apiKey);
}

// Initialize Supabase client
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey
);

export async function processEmailJob(job: Job): Promise<void> {
  const startTime = Date.now();
  let status: 'success' | 'failure' = 'success';
  
  try {
    const emailJob = EmailJobSchema.parse(job.data);
    logger.info({ 
      jobId: job.id, 
      type: emailJob.type,
      userId: emailJob.data.userId,
    }, 'Processing email job');

    // Process based on email type
    switch (emailJob.type) {
      case 'opportunity-reminder':
        await sendOpportunityReminder(emailJob.data);
        break;
      case 'welcome':
        await sendWelcomeEmail(emailJob.data);
        break;
      case 'proposal-submitted':
        await sendProposalSubmittedEmail(emailJob.data);
        break;
      case 'weekly-summary':
        await sendWeeklySummary(emailJob.data);
        break;
    }

    // Record email sent
    emailsSent.inc({ type: emailJob.type, status: 'success' });

    // Update user email preferences
    await updateEmailActivity(emailJob.data.userId, emailJob.type);

  } catch (error) {
    status = 'failure';
    logger.error({ 
      error, 
      jobId: job.id,
      jobData: job.data,
    }, 'Email job failed');
    
    emailsSent.inc({ 
      type: job.data.type || 'unknown', 
      status: 'failure' 
    });
    
    throw error;
  } finally {
    const duration = (Date.now() - startTime) / 1000;
    recordJobMetrics('email', job.name, duration, status);
  }
}

async function sendOpportunityReminder(data: any): Promise<void> {
  const { email, opportunities } = data;

  const emailContent = {
    to: email,
    from: config.email.from,
    subject: '🔔 Upcoming Opportunity Deadlines - MedContractHub',
    html: generateOpportunityReminderHTML(opportunities),
    text: generateOpportunityReminderText(opportunities),
  };

  await sendEmail(emailContent);
  logger.info({ 
    email, 
    opportunityCount: opportunities.length 
  }, 'Sent opportunity reminder');
}

async function sendWelcomeEmail(data: any): Promise<void> {
  const { email, name } = data;

  const emailContent = {
    to: email,
    from: config.email.from,
    subject: 'Welcome to MedContractHub! 🎉',
    html: generateWelcomeHTML(name),
    text: generateWelcomeText(name),
  };

  await sendEmail(emailContent);
  logger.info({ email }, 'Sent welcome email');
}

async function sendProposalSubmittedEmail(data: any): Promise<void> {
  const { email, proposalId, opportunityTitle, submittedAt } = data;

  const emailContent = {
    to: email,
    from: config.email.from,
    subject: `✅ Proposal Submitted: ${opportunityTitle}`,
    html: generateProposalSubmittedHTML(proposalId, opportunityTitle, submittedAt),
    text: generateProposalSubmittedText(proposalId, opportunityTitle, submittedAt),
  };

  await sendEmail(emailContent);
  logger.info({ email, proposalId }, 'Sent proposal submitted email');
}

async function sendWeeklySummary(data: any): Promise<void> {
  const { email, stats, topOpportunities } = data;

  const emailContent = {
    to: email,
    from: config.email.from,
    subject: '📊 Your Weekly MedContractHub Summary',
    html: generateWeeklySummaryHTML(stats, topOpportunities),
    text: generateWeeklySummaryText(stats, topOpportunities),
  };

  await sendEmail(emailContent);
  logger.info({ email }, 'Sent weekly summary');
}

async function sendEmail(emailContent: any): Promise<void> {
  if (config.email.provider === 'console') {
    // Development mode - log to console
    logger.info({ emailContent }, 'Email (console mode)');
    return;
  }

  if (config.email.provider === 'sendgrid') {
    await sgMail.send(emailContent);
  } else if (config.email.provider === 'smtp') {
    // TODO: Implement SMTP sending
    throw new Error('SMTP provider not yet implemented');
  }
}

async function updateEmailActivity(userId: string, emailType: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_email_activity')
      .insert({
        user_id: userId,
        email_type: emailType,
        sent_at: new Date().toISOString(),
      });

    if (error) {
      logger.error({ error, userId, emailType }, 'Failed to update email activity');
    }
  } catch (error) {
    logger.error({ error, userId, emailType }, 'Error updating email activity');
  }
}

// Email template generators
function generateOpportunityReminderHTML(opportunities: any[]): string {
  const opportunityList = opportunities
    .map(opp => `
      <li style="margin-bottom: 15px;">
        <strong>${opp.title}</strong><br>
        Agency: ${opp.agency}<br>
        Deadline: ${format(new Date(opp.responseDeadline), 'PPP')}<br>
        <span style="color: ${opp.daysUntilDeadline <= 3 ? '#e53e3e' : '#3182ce'};">
          ${opp.daysUntilDeadline} days remaining
        </span>
      </li>
    `)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Upcoming Opportunity Deadlines</h2>
      <p>Don't miss these opportunities with approaching deadlines:</p>
      <ul>${opportunityList}</ul>
      <p><a href="https://medcontracthub.com/opportunities" style="background: #3182ce; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View All Opportunities</a></p>
    </body>
    </html>
  `;
}

function generateOpportunityReminderText(opportunities: any[]): string {
  const opportunityList = opportunities
    .map(opp => `
- ${opp.title}
  Agency: ${opp.agency}
  Deadline: ${format(new Date(opp.responseDeadline), 'PPP')}
  ${opp.daysUntilDeadline} days remaining
    `)
    .join('\n');

  return `
Upcoming Opportunity Deadlines

Don't miss these opportunities with approaching deadlines:

${opportunityList}

View all opportunities at: https://medcontracthub.com/opportunities
  `;
}

function generateWelcomeHTML(name: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Welcome to MedContractHub, ${name}! 🎉</h1>
      <p>We're excited to have you on board. MedContractHub helps you discover and win federal contracts with AI-powered tools.</p>
      <h3>Get Started:</h3>
      <ul>
        <li>Set up your company profile</li>
        <li>Configure your NAICS codes</li>
        <li>Browse current opportunities</li>
        <li>Generate your first proposal</li>
      </ul>
      <p><a href="https://medcontracthub.com/onboarding" style="background: #3182ce; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Your Profile</a></p>
    </body>
    </html>
  `;
}

function generateWelcomeText(name: string): string {
  return `
Welcome to MedContractHub, ${name}! 🎉

We're excited to have you on board. MedContractHub helps you discover and win federal contracts with AI-powered tools.

Get Started:
- Set up your company profile
- Configure your NAICS codes
- Browse current opportunities
- Generate your first proposal

Complete your profile at: https://medcontracthub.com/onboarding
  `;
}

function generateProposalSubmittedHTML(proposalId: string, opportunityTitle: string, submittedAt: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>✅ Proposal Successfully Submitted</h2>
      <p>Your proposal has been submitted for:</p>
      <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <strong>${opportunityTitle}</strong><br>
        Submitted: ${format(new Date(submittedAt), 'PPPp')}<br>
        Proposal ID: ${proposalId}
      </div>
      <p>You can track the status of your proposal in your dashboard.</p>
      <p><a href="https://medcontracthub.com/proposals/${proposalId}" style="background: #3182ce; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Proposal</a></p>
    </body>
    </html>
  `;
}

function generateProposalSubmittedText(proposalId: string, opportunityTitle: string, submittedAt: string): string {
  return `
✅ Proposal Successfully Submitted

Your proposal has been submitted for:
${opportunityTitle}

Submitted: ${format(new Date(submittedAt), 'PPPp')}
Proposal ID: ${proposalId}

You can track the status of your proposal at:
https://medcontracthub.com/proposals/${proposalId}
  `;
}

function generateWeeklySummaryHTML(stats: any, topOpportunities: any[]): string {
  const opportunityList = topOpportunities
    .map(opp => `<li>${opp.title} - ${opp.agency}</li>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>📊 Your Weekly Summary</h2>
      <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>This Week's Activity:</h3>
        <ul>
          <li>New Opportunities: <strong>${stats.newOpportunities}</strong></li>
          <li>Proposals Submitted: <strong>${stats.proposalsSubmitted}</strong></li>
          <li>Upcoming Deadlines: <strong>${stats.upcomingDeadlines}</strong></li>
        </ul>
      </div>
      <h3>Top Opportunities This Week:</h3>
      <ul>${opportunityList}</ul>
      <p><a href="https://medcontracthub.com/dashboard" style="background: #3182ce; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a></p>
    </body>
    </html>
  `;
}

function generateWeeklySummaryText(stats: any, topOpportunities: any[]): string {
  const opportunityList = topOpportunities
    .map(opp => `- ${opp.title} - ${opp.agency}`)
    .join('\n');

  return `
📊 Your Weekly Summary

This Week's Activity:
- New Opportunities: ${stats.newOpportunities}
- Proposals Submitted: ${stats.proposalsSubmitted}
- Upcoming Deadlines: ${stats.upcomingDeadlines}

Top Opportunities This Week:
${opportunityList}

View your dashboard at: https://medcontracthub.com/dashboard
  `;
}