import { Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { z } from 'zod';
import { config } from '../config';
import { logger } from '../utils/logger';
import { syncOperations, syncDuration, recordsSynced, recordJobMetrics } from '../utils/metrics';
import PQueue from 'p-queue';
import { differenceInDays, subDays, format } from 'date-fns';
import retry from 'retry';

// Sync job schemas
export const SyncJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sam-gov-opportunities'),
    data: z.object({
      fullSync: z.boolean().default(false),
      dateRange: z.object({
        start: z.string(),
        end: z.string(),
      }).optional(),
      naicsCodes: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    type: z.literal('sam-gov-entities'),
    data: z.object({
      entityIds: z.array(z.string()).optional(),
      ueiList: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    type: z.literal('cleanup-old-data'),
    data: z.object({
      tables: z.array(z.string()),
      retentionDays: z.number(),
      dryRun: z.boolean().default(false),
    }),
  }),
  z.object({
    type: z.literal('refresh-analytics'),
    data: z.object({
      metrics: z.array(z.string()),
      dateRange: z.object({
        start: z.string(),
        end: z.string(),
      }),
    }),
  }),
]);

export type SyncJob = z.infer<typeof SyncJobSchema>;

// Initialize Supabase client
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey
);

// SAM.gov API client
class SamGovClient {
  private baseUrl: string;
  private apiKey?: string;
  private queue: PQueue;

  constructor() {
    this.baseUrl = config.samGov.baseUrl;
    this.apiKey = config.samGov.apiKey;
    this.queue = new PQueue({ 
      concurrency: config.samGov.maxConcurrentRequests,
      interval: 1000,
      intervalCap: 10, // Max 10 requests per second
    });
  }

  async searchOpportunities(params: any): Promise<any> {
    return this.queue.add(async () => {
      const operation = retry.operation({
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 10000,
      });

      return new Promise((resolve, reject) => {
        operation.attempt(async () => {
          try {
            const response = await axios.get(`${this.baseUrl}/opportunities/v2/search`, {
              params: {
                api_key: this.apiKey,
                limit: 100,
                ...params,
              },
              timeout: 30000,
            });

            resolve(response.data);
          } catch (error: any) {
            if (operation.retry(error)) {
              return;
            }
            reject(operation.mainError());
          }
        });
      });
    });
  }

  async getEntity(uei: string): Promise<any> {
    return this.queue.add(async () => {
      try {
        const response = await axios.get(`${this.baseUrl}/entity-information/v3/entities/${uei}`, {
          params: { api_key: this.apiKey },
          timeout: 30000,
        });
        return response.data;
      } catch (error) {
        logger.error({ error, uei }, 'Failed to fetch entity');
        throw error;
      }
    });
  }
}

const samGovClient = new SamGovClient();

export async function processSyncJob(job: Job): Promise<void> {
  const startTime = Date.now();
  let status: 'success' | 'failure' = 'success';
  
  try {
    const syncJob = SyncJobSchema.parse(job.data);
    logger.info({ 
      jobId: job.id, 
      type: syncJob.type,
    }, 'Processing sync job');

    let result: any;
    switch (syncJob.type) {
      case 'sam-gov-opportunities':
        result = await syncSamGovOpportunities(syncJob.data, job);
        break;
      case 'sam-gov-entities':
        result = await syncSamGovEntities(syncJob.data, job);
        break;
      case 'cleanup-old-data':
        result = await cleanupOldData(syncJob.data, job);
        break;
      case 'refresh-analytics':
        result = await refreshAnalytics(syncJob.data, job);
        break;
    }

    syncOperations.inc({ source: syncJob.type, status: 'success' });
    logger.info({ jobId: job.id, result }, 'Sync job completed');

  } catch (error) {
    status = 'failure';
    logger.error({ 
      error, 
      jobId: job.id,
      jobData: job.data,
    }, 'Sync job failed');
    
    syncOperations.inc({ 
      source: job.data.type || 'unknown', 
      status: 'failure' 
    });
    
    throw error;
  } finally {
    const duration = (Date.now() - startTime) / 1000;
    recordJobMetrics('sync', job.name, duration, status);
    syncDuration.observe({ source: job.data.type }, duration);
  }
}

async function syncSamGovOpportunities(data: any, job: Job): Promise<any> {
  const { fullSync, dateRange, naicsCodes } = data;
  
  let syncedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let offset = 0;
  const limit = 100;

  // Determine date range
  const startDate = dateRange?.start || 
    (fullSync ? '2024-01-01' : format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const endDate = dateRange?.end || format(new Date(), 'yyyy-MM-dd');

  logger.info({ startDate, endDate, fullSync }, 'Starting opportunity sync');

  while (true) {
    try {
      // Search parameters
      const searchParams: any = {
        postedFrom: startDate,
        postedTo: endDate,
        offset,
        limit,
      };

      // Add NAICS filter if provided
      if (naicsCodes && naicsCodes.length > 0) {
        searchParams.ncode = naicsCodes.join(',');
      }

      // Fetch opportunities
      const response = await samGovClient.searchOpportunities(searchParams);
      
      if (!response.opportunitiesData || response.opportunitiesData.length === 0) {
        break;
      }

      // Process opportunities in batches
      const opportunities = response.opportunitiesData;
      const processedOpportunities = opportunities.map((opp: any) => ({
        notice_id: opp.noticeId,
        title: opp.title,
        sol_number: opp.solicitationNumber,
        agency: opp.department?.name || 'Unknown',
        sub_agency: opp.subAgency?.name,
        notice_type: opp.type,
        contract_type: opp.typeOfSetAside,
        naics_code: opp.naicsCode,
        response_deadline: opp.responseDeadLine,
        posted_date: opp.postedDate,
        last_updated: opp.lastUpdatedDate,
        description: opp.description,
        primary_contact_email: opp.pointOfContact?.[0]?.email,
        primary_contact_phone: opp.pointOfContact?.[0]?.phone,
        set_aside_type: opp.typeOfSetAsideDescription,
        place_of_performance_city: opp.placeOfPerformance?.city,
        place_of_performance_state: opp.placeOfPerformance?.state,
        additional_info_link: opp.additionalInfoLink,
        uei: opp.uei,
        award_amount: opp.awardAmount,
        award_date: opp.awardDate,
        active: opp.active === 'Yes',
        raw_data: opp,
      }));

      // Upsert to database
      const { error } = await supabase
        .from('opportunities')
        .upsert(processedOpportunities, {
          onConflict: 'notice_id',
          ignoreDuplicates: false,
        });

      if (error) {
        logger.error({ error }, 'Failed to upsert opportunities');
        errorCount += opportunities.length;
      } else {
        syncedCount += opportunities.length;
        recordsSynced.inc({ 
          source: 'sam-gov', 
          type: 'opportunities' 
        }, opportunities.length);
      }

      // Update progress
      const progress = Math.min(90, (offset / (response.totalRecords || 1000)) * 100);
      await job.updateProgress(progress);

      // Check if we've fetched all records
      if (offset + limit >= (response.totalRecords || 0)) {
        break;
      }

      offset += limit;
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, config.samGov.requestDelayMs));

    } catch (error) {
      logger.error({ error, offset }, 'Error during opportunity sync');
      errorCount++;
      
      // Continue with next batch on error
      offset += limit;
    }
  }

  // Log sync summary
  await supabase
    .from('sync_logs')
    .insert({
      sync_type: 'sam-gov-opportunities',
      records_synced: syncedCount,
      records_updated: updatedCount,
      errors: errorCount,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      metadata: { fullSync, dateRange, naicsCodes },
    });

  return { syncedCount, updatedCount, errorCount };
}

async function syncSamGovEntities(data: any, job: Job): Promise<any> {
  const { entityIds, ueiList } = data;
  
  let syncedCount = 0;
  let errorCount = 0;
  
  const entitiesToSync = ueiList || entityIds || [];
  
  for (let i = 0; i < entitiesToSync.length; i++) {
    try {
      const uei = entitiesToSync[i];
      const entity = await samGovClient.getEntity(uei);
      
      // Store entity data
      const { error } = await supabase
        .from('entities')
        .upsert({
          uei: entity.entityRegistration.uei,
          legal_name: entity.entityRegistration.legalBusinessName,
          dba_name: entity.entityRegistration.dbaName,
          physical_address: entity.entityRegistration.physicalAddress,
          mailing_address: entity.entityRegistration.mailingAddress,
          business_types: entity.entityRegistration.businessTypes,
          naics_codes: entity.entityRegistration.naicsCodes,
          registration_date: entity.entityRegistration.registrationDate,
          expiration_date: entity.entityRegistration.expirationDate,
          active: entity.entityRegistration.registrationStatus === 'Active',
          raw_data: entity,
          last_updated: new Date().toISOString(),
        }, {
          onConflict: 'uei',
        });

      if (error) {
        logger.error({ error, uei }, 'Failed to sync entity');
        errorCount++;
      } else {
        syncedCount++;
        recordsSynced.inc({ source: 'sam-gov', type: 'entities' }, 1);
      }

      // Update progress
      await job.updateProgress((i / entitiesToSync.length) * 100);
      
    } catch (error) {
      logger.error({ error, entityId: entitiesToSync[i] }, 'Error syncing entity');
      errorCount++;
    }
  }

  return { syncedCount, errorCount };
}

async function cleanupOldData(data: any, job: Job): Promise<any> {
  const { tables, retentionDays, dryRun } = data;
  
  const cutoffDate = format(subDays(new Date(), retentionDays), 'yyyy-MM-dd');
  const results: any = {};

  for (const table of tables) {
    try {
      // First count records to be deleted
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoffDate);

      results[table] = { count: count || 0 };

      if (!dryRun && count && count > 0) {
        // Perform deletion
        const { error } = await supabase
          .from(table)
          .delete()
          .lt('created_at', cutoffDate);

        if (error) {
          results[table].error = error.message;
          logger.error({ error, table }, 'Cleanup error');
        } else {
          results[table].deleted = true;
          logger.info({ table, count }, 'Cleaned up old records');
        }
      }

      await job.updateProgress((tables.indexOf(table) + 1) / tables.length * 100);

    } catch (error) {
      logger.error({ error, table }, 'Error during cleanup');
      results[table] = { error: error };
    }
  }

  return { cutoffDate, dryRun, results };
}

async function refreshAnalytics(data: any, job: Job): Promise<any> {
  const { metrics, dateRange } = data;
  
  const results: any = {};
  
  for (const metric of metrics) {
    try {
      switch (metric) {
        case 'opportunity_trends':
          results[metric] = await calculateOpportunityTrends(dateRange);
          break;
        case 'agency_distribution':
          results[metric] = await calculateAgencyDistribution(dateRange);
          break;
        case 'naics_distribution':
          results[metric] = await calculateNAICSDistribution(dateRange);
          break;
        case 'win_rate':
          results[metric] = await calculateWinRate(dateRange);
          break;
        default:
          logger.warn({ metric }, 'Unknown metric');
      }

      await job.updateProgress((metrics.indexOf(metric) + 1) / metrics.length * 100);

    } catch (error) {
      logger.error({ error, metric }, 'Error calculating metric');
      results[metric] = { error: error };
    }
  }

  // Store analytics snapshot
  await supabase
    .from('analytics_snapshots')
    .insert({
      metrics: results,
      date_range: dateRange,
      created_at: new Date().toISOString(),
    });

  return results;
}

// Analytics calculation functions
async function calculateOpportunityTrends(dateRange: any): Promise<any> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('posted_date, notice_type, naics_code')
    .gte('posted_date', dateRange.start)
    .lte('posted_date', dateRange.end);

  if (error) throw error;

  // Group by date and calculate trends
  const trends: any = {};
  data?.forEach(opp => {
    const date = opp.posted_date.split('T')[0];
    if (!trends[date]) {
      trends[date] = { total: 0, byType: {} };
    }
    trends[date].total++;
    trends[date].byType[opp.notice_type] = (trends[date].byType[opp.notice_type] || 0) + 1;
  });

  return trends;
}

async function calculateAgencyDistribution(dateRange: any): Promise<any> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('agency')
    .gte('posted_date', dateRange.start)
    .lte('posted_date', dateRange.end);

  if (error) throw error;

  const distribution: any = {};
  data?.forEach(opp => {
    distribution[opp.agency] = (distribution[opp.agency] || 0) + 1;
  });

  return distribution;
}

async function calculateNAICSDistribution(dateRange: any): Promise<any> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('naics_code')
    .gte('posted_date', dateRange.start)
    .lte('posted_date', dateRange.end);

  if (error) throw error;

  const distribution: any = {};
  data?.forEach(opp => {
    if (opp.naics_code) {
      distribution[opp.naics_code] = (distribution[opp.naics_code] || 0) + 1;
    }
  });

  return distribution;
}

async function calculateWinRate(dateRange: any): Promise<any> {
  const { data, error } = await supabase
    .from('proposals')
    .select('status, submitted_at')
    .gte('submitted_at', dateRange.start)
    .lte('submitted_at', dateRange.end);

  if (error) throw error;

  const stats = {
    total: data?.length || 0,
    won: 0,
    lost: 0,
    pending: 0,
  };

  data?.forEach(proposal => {
    if (proposal.status === 'won') stats.won++;
    else if (proposal.status === 'lost') stats.lost++;
    else stats.pending++;
  });

  return {
    ...stats,
    winRate: stats.total > 0 ? (stats.won / stats.total) * 100 : 0,
  };
}