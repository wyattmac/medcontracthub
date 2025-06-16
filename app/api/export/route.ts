/**
 * API Route: Export opportunities and analytics data
 * POST /api/export
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler, IRouteContext } from '@/lib/api/route-handler-next15'
import { DatabaseError, ValidationError } from '@/lib/errors/types'
import { apiLogger } from '@/lib/errors/logger'
import { generatePDFReport } from '@/lib/export/pdf-generator'
import { generateExcelExport } from '@/lib/export/excel-generator'
import { withUsageCheck } from '@/lib/usage/tracker'

// Request body validation
const exportRequestSchema = z.object({
  type: z.enum(['pdf', 'excel']),
  format: z.enum(['opportunities', 'analytics', 'proposals']),
  filters: z.object({
    period: z.enum(['7d', '30d', '90d', '1y']).optional(),
    naics: z.array(z.string()).optional(),
    state: z.string().optional(),
    status: z.string().optional(),
    opportunityIds: z.array(z.string()).optional()
  }).optional(),
  options: z.object({
    includeAnalysis: z.boolean().default(false),
    includeCharts: z.boolean().default(false),
    template: z.enum(['standard', 'executive', 'detailed']).default('standard')
  }).optional()
})

export const POST = routeHandler.POST(
  async ({ request, user, supabase }: IRouteContext) => {
    const body = await request.json()
    const { type, format, filters, options } = exportRequestSchema.parse(body)

    apiLogger.info('Export request started', {
      userId: user.id,
      type,
      format,
      filters,
      options
    })

    try {
      let exportData: any

      // Fetch data based on format
      switch (format) {
        case 'opportunities':
          exportData = await getOpportunitiesData(supabase, user.id, filters)
          break
        case 'analytics':
          exportData = await getAnalyticsData(supabase, user.id, filters)
          break
        case 'proposals':
          exportData = await getProposalsData(supabase, user.id, filters)
          break
        default:
          throw new ValidationError('Invalid export format')
      }

      // Generate export based on type with usage tracking
      const exportResult = await withUsageCheck(
        user.id,
        'export_data',
        1,
        async () => {
          if (type === 'pdf') {
            const result = await generatePDFReport(exportData, format, options)
            return {
              buffer: result.buffer,
              filename: result.filename,
              mimeType: 'application/pdf'
            }
          } else if (type === 'excel') {
            const result = await generateExcelExport(exportData, format, options)
            return {
              buffer: result.buffer,
              filename: result.filename,
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
          } else {
            throw new ValidationError('Invalid export type')
          }
        }
      )
      
      const { buffer, filename, mimeType } = exportResult

      // Log successful export
      await supabase.rpc('log_audit', {
        p_action: 'export_generated',
        p_entity_type: format,
        p_entity_id: null,
        p_changes: {
          export_type: type,
          format,
          record_count: Array.isArray(exportData) ? exportData.length : 1,
          file_size: buffer.length
        }
      }).catch((error: any) => {
        apiLogger.warn('Failed to log export audit', error)
      })

      apiLogger.info('Export completed successfully', {
        userId: user.id,
        type,
        format,
        fileSize: buffer.length,
        filename
      })

      // Return the file as a download
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })

    } catch (error: any) {
      apiLogger.error('Export generation failed', error, {
        userId: user.id,
        type,
        format,
        filters
      })

      if (error instanceof ValidationError) {
        throw error
      }

      throw new DatabaseError('Failed to generate export')
    }
  },
  {
    requireAuth: true,
    validateBody: exportRequestSchema,
    rateLimit: {
      interval: 60 * 1000, // 1 minute
      uniqueTokenPerInterval: 10 // 10 exports per minute per user
    }
  }
)

/**
 * Get opportunities data for export
 */
async function getOpportunitiesData(
  supabase: any,
  userId: string,
  filters?: any
) {
  let query = supabase
    .from('opportunities')
    .select(`
      id,
      title,
      description,
      solicitation_number,
      posted_date,
      response_deadline,
      estimated_value,
      place_of_performance,
      naics_codes,
      status,
      procurement_type,
      contact_info,
      saved_opportunities!left (
        id,
        created_at,
        notes,
        tags
      )
    `)

  // Apply filters
  if (filters?.opportunityIds?.length) {
    query = query.in('id', filters.opportunityIds)
  }

  if (filters?.naics?.length) {
    query = query.overlaps('naics_codes', filters.naics)
  }

  if (filters?.state) {
    query = query.ilike('place_of_performance', `%${filters.state}%`)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.period) {
    const days = filters.period === '7d' ? 7 : 
                  filters.period === '30d' ? 30 : 
                  filters.period === '90d' ? 90 : 365
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('posted_date', startDate)
  }

  const { data, error } = await query
    .order('posted_date', { ascending: false })
    .limit(1000) // Reasonable limit for exports

  if (error) {
    throw new DatabaseError('Failed to fetch opportunities data')
  }

  return data || []
}

/**
 * Get analytics data for export
 */
async function getAnalyticsData(
  supabase: any,
  userId: string,
  filters?: any
) {
  const period = filters?.period || '30d'
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const endDate = new Date()

  // Get analytics data (similar to analytics API)
  const [timelineData, summaryData, performanceData] = await Promise.all([
    supabase.rpc('get_opportunities_timeline', {
      p_user_id: userId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_interval_days: Math.max(1, Math.floor(days / 20))
    }),
    getSummaryStats(supabase, userId),
    getPerformanceAnalytics(supabase, userId, startDate, endDate)
  ])

  return {
    timeline: timelineData.data || [],
    summary: summaryData,
    performance: performanceData,
    period,
    generatedAt: new Date().toISOString()
  }
}

/**
 * Get proposals data for export
 */
async function getProposalsData(
  supabase: any,
  userId: string,
  _filters?: any
) {
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      id,
      title,
      status,
      created_at,
      updated_at,
      opportunity_id,
      content,
      opportunities (
        title,
        solicitation_number,
        response_deadline,
        estimated_value
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    throw new DatabaseError('Failed to fetch proposals data')
  }

  return data || []
}

/**
 * Get summary statistics (reused from analytics)
 */
async function getSummaryStats(supabase: any, userId: string) {
  const [
    { count: totalOpportunities },
    { count: totalSaved },
    { count: totalAnalyses },
    { count: totalProposals }
  ] = await Promise.all([
    supabase.from('opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('saved_opportunities').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('opportunity_analyses').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('user_id', userId)
  ])

  return {
    totalOpportunities: totalOpportunities || 0,
    totalSaved: totalSaved || 0,
    totalAnalyses: totalAnalyses || 0,
    totalProposals: totalProposals || 0
  }
}

/**
 * Get performance analytics (simplified version)
 */
async function getPerformanceAnalytics(
  supabase: any,
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const { data: savedData } = await supabase
    .from('saved_opportunities')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const { data: analysesData } = await supabase
    .from('opportunity_analyses')
    .select('created_at, analysis_result')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  return {
    totalSaved: savedData?.length || 0,
    totalAnalyses: analysesData?.length || 0
  }
}