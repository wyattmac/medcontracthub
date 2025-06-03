/**
 * Excel Generation Utility
 * Uses XLSX/SheetJS to generate Excel workbooks
 */

import * as XLSX from 'xlsx'
import { format } from 'date-fns'

interface IExcelGeneratorOptions {
  includeAnalysis?: boolean
  includeCharts?: boolean
  template?: 'standard' | 'executive' | 'detailed'
}

/**
 * Generate Excel export based on data and format
 */
export async function generateExcelExport(
  data: any,
  exportFormat: 'opportunities' | 'analytics' | 'proposals',
  options: IExcelGeneratorOptions = {}
): Promise<{ buffer: Buffer; filename: string }> {
  
  let workbook: XLSX.WorkBook

  switch (exportFormat) {
    case 'opportunities':
      workbook = generateOpportunitiesWorkbook(data, options)
      break
    case 'analytics':
      workbook = generateAnalyticsWorkbook(data, options)
      break
    case 'proposals':
      workbook = generateProposalsWorkbook(data, options)
      break
    default:
      throw new Error('Invalid export format')
  }

  // Generate buffer from workbook
  const buffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm')
  const filename = `${exportFormat}-export-${timestamp}.xlsx`

  return {
    buffer,
    filename
  }
}

/**
 * Generate Opportunities Excel Workbook
 */
function generateOpportunitiesWorkbook(data: any[], options: IExcelGeneratorOptions): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()

  // Main opportunities sheet
  const opportunitiesData = data.map(opp => ({
    'Solicitation Number': opp.solicitation_number || '',
    'Title': opp.title || '',
    'Status': opp.status || '',
    'Posted Date': opp.posted_date ? format(new Date(opp.posted_date), 'yyyy-MM-dd') : '',
    'Response Deadline': opp.response_deadline ? format(new Date(opp.response_deadline), 'yyyy-MM-dd') : '',
    'Estimated Value': opp.estimated_value || '',
    'Place of Performance': opp.place_of_performance || '',
    'NAICS Codes': Array.isArray(opp.naics_codes) ? opp.naics_codes.join(', ') : '',
    'Procurement Type': opp.procurement_type || '',
    'Contact Email': opp.contact_info?.email || '',
    'Contact Phone': opp.contact_info?.phone || '',
    'Is Saved': opp.saved_opportunities?.length > 0 ? 'Yes' : 'No',
    'Save Date': opp.saved_opportunities?.[0]?.created_at ? 
      format(new Date(opp.saved_opportunities[0].created_at), 'yyyy-MM-dd') : '',
    'Notes': opp.saved_opportunities?.[0]?.notes || '',
    'Tags': opp.saved_opportunities?.[0]?.tags ? 
      opp.saved_opportunities[0].tags.join(', ') : ''
  }))

  const opportunitiesWS = XLSX.utils.json_to_sheet(opportunitiesData)
  
  // Auto-size columns
  const opportunitiesColWidths = getColumnWidths(opportunitiesData)
  opportunitiesWS['!cols'] = opportunitiesColWidths

  XLSX.utils.book_append_sheet(workbook, opportunitiesWS, 'Opportunities')

  // Summary sheet
  const summaryData = [
    ['Report Generated', format(new Date(), 'PPP')],
    ['Total Opportunities', data.length],
    ['Saved Opportunities', data.filter(opp => opp.saved_opportunities?.length > 0).length],
    ['Active Opportunities', data.filter(opp => opp.status === 'active').length],
    ['Posted Opportunities', data.filter(opp => opp.status === 'posted').length],
    ['Archived Opportunities', data.filter(opp => opp.status === 'archived').length]
  ]

  const summaryWS = XLSX.utils.aoa_to_sheet([
    ['MedContractHub - Opportunities Export Summary'],
    [''],
    ...summaryData
  ])

  // Style the summary sheet
  summaryWS['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
  summaryWS['!cols'] = [{ wch: 25 }, { wch: 20 }]

  XLSX.utils.book_append_sheet(workbook, summaryWS, 'Summary')

  // NAICS analysis sheet if requested
  if (options.includeAnalysis) {
    const naicsAnalysis = generateNAICSAnalysis(data)
    const naicsWS = XLSX.utils.json_to_sheet(naicsAnalysis)
    naicsWS['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(workbook, naicsWS, 'NAICS Analysis')
  }

  return workbook
}

/**
 * Generate Analytics Excel Workbook
 */
function generateAnalyticsWorkbook(data: any, options: IExcelGeneratorOptions): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()

  // Summary sheet
  const summaryData = [
    ['Report Period', data.period],
    ['Generated On', format(new Date(), 'PPP')],
    [''],
    ['Total Opportunities', data.summary?.totalOpportunities || 0],
    ['Saved Opportunities', data.summary?.totalSaved || 0],
    ['AI Analyses', data.summary?.totalAnalyses || 0],
    ['Proposals Created', data.summary?.totalProposals || 0],
    ['Recent Activity (7 days)', data.summary?.recentActivity || 0]
  ]

  const summaryWS = XLSX.utils.aoa_to_sheet([
    ['MedContractHub - Analytics Report'],
    [''],
    ...summaryData
  ])

  summaryWS['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
  summaryWS['!cols'] = [{ wch: 25 }, { wch: 20 }]

  XLSX.utils.book_append_sheet(workbook, summaryWS, 'Summary')

  // Timeline data sheet
  if (data.timeline && data.timeline.length > 0) {
    const timelineData = data.timeline.map((item: any) => ({
      'Date': item.date,
      'Total Opportunities': item.total_opportunities,
      'New Opportunities': item.new_opportunities,
      'Saved Count': item.saved_count
    }))

    const timelineWS = XLSX.utils.json_to_sheet(timelineData)
    timelineWS['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(workbook, timelineWS, 'Timeline Data')
  }

  // Performance data sheet
  if (data.performance) {
    const performanceData = [
      ['Metric', 'Value'],
      ['Total Saved', data.performance.totalSaved || 0],
      ['Total Analyses', data.performance.totalAnalyses || 0],
      ['Average Win Probability', `${data.performance.avgWinProbability || 0}%`]
    ]

    const performanceWS = XLSX.utils.aoa_to_sheet(performanceData)
    performanceWS['!cols'] = [{ wch: 25 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(workbook, performanceWS, 'Performance')
  }

  return workbook
}

/**
 * Generate Proposals Excel Workbook
 */
function generateProposalsWorkbook(data: any[], options: IExcelGeneratorOptions): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()

  // Main proposals sheet
  const proposalsData = data.map(proposal => ({
    'Title': proposal.title || '',
    'Status': proposal.status || '',
    'Created Date': format(new Date(proposal.created_at), 'yyyy-MM-dd'),
    'Updated Date': format(new Date(proposal.updated_at), 'yyyy-MM-dd'),
    'Opportunity Title': proposal.opportunities?.title || '',
    'Solicitation Number': proposal.opportunities?.solicitation_number || '',
    'Response Deadline': proposal.opportunities?.response_deadline ? 
      format(new Date(proposal.opportunities.response_deadline), 'yyyy-MM-dd') : '',
    'Estimated Value': proposal.opportunities?.estimated_value || '',
    'Content Length': proposal.content ? proposal.content.length : 0
  }))

  const proposalsWS = XLSX.utils.json_to_sheet(proposalsData)
  const proposalsColWidths = getColumnWidths(proposalsData)
  proposalsWS['!cols'] = proposalsColWidths

  XLSX.utils.book_append_sheet(workbook, proposalsWS, 'Proposals')

  // Summary sheet
  const summaryData = [
    ['Report Generated', format(new Date(), 'PPP')],
    ['Total Proposals', data.length],
    ['Draft Proposals', data.filter(p => p.status === 'draft').length],
    ['Submitted Proposals', data.filter(p => p.status === 'submitted').length],
    ['Under Review', data.filter(p => p.status === 'under_review').length],
    ['Awarded', data.filter(p => p.status === 'awarded').length],
    ['Rejected', data.filter(p => p.status === 'rejected').length]
  ]

  const summaryWS = XLSX.utils.aoa_to_sheet([
    ['MedContractHub - Proposals Export Summary'],
    [''],
    ...summaryData
  ])

  summaryWS['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
  summaryWS['!cols'] = [{ wch: 25 }, { wch: 20 }]

  XLSX.utils.book_append_sheet(workbook, summaryWS, 'Summary')

  // Status breakdown sheet
  const statusBreakdown = data.reduce((acc: any, proposal) => {
    const status = proposal.status || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  const statusData = Object.entries(statusBreakdown).map(([status, count]) => ({
    'Status': status,
    'Count': count,
    'Percentage': `${Math.round((count as number / data.length) * 100)}%`
  }))

  const statusWS = XLSX.utils.json_to_sheet(statusData)
  statusWS['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(workbook, statusWS, 'Status Breakdown')

  return workbook
}

/**
 * Generate NAICS analysis for opportunities
 */
function generateNAICSAnalysis(opportunities: any[]): any[] {
  const naicsCount: Record<string, { count: number; opportunities: string[] }> = {}

  opportunities.forEach(opp => {
    if (Array.isArray(opp.naics_codes)) {
      opp.naics_codes.forEach((code: string) => {
        if (!naicsCount[code]) {
          naicsCount[code] = { count: 0, opportunities: [] }
        }
        naicsCount[code].count++
        naicsCount[code].opportunities.push(opp.title || 'Untitled')
      })
    }
  })

  const totalOpportunities = opportunities.length

  return Object.entries(naicsCount)
    .map(([code, naicsData]) => ({
      'NAICS Code': code,
      'Description': getNAICSDescription(code),
      'Opportunity Count': naicsData.count,
      'Percentage': `${Math.round((naicsData.count / totalOpportunities) * 100)}%`
    }))
    .sort((a, b) => b['Opportunity Count'] - a['Opportunity Count'])
}

/**
 * Get NAICS code description
 */
function getNAICSDescription(code: string): string {
  const naicsMap: Record<string, string> = {
    '621': 'Ambulatory Health Care Services',
    '622': 'Hospitals',
    '623': 'Nursing and Residential Care Facilities',
    '325': 'Chemical Manufacturing',
    '334': 'Computer and Electronic Product Manufacturing',
    '336': 'Transportation Equipment Manufacturing',
    '541': 'Professional, Scientific, and Technical Services',
    '562': 'Waste Management and Remediation Services',
    '811': 'Repair and Maintenance',
    '928': 'National Security and International Affairs'
  }

  // Try exact match first
  if (naicsMap[code]) return naicsMap[code]
  
  // Try partial match (first 3 digits)
  const partialMatch = naicsMap[code.substring(0, 3)]
  if (partialMatch) return partialMatch

  return `NAICS ${code}`
}

/**
 * Calculate optimal column widths for Excel
 */
function getColumnWidths(data: any[]): any[] {
  if (data.length === 0) return []

  const keys = Object.keys(data[0])
  return keys.map(key => {
    const maxLength = Math.max(
      key.length, // Header length
      ...data.map(row => {
        const value = row[key]
        return value ? value.toString().length : 0
      })
    )
    return { wch: Math.min(Math.max(maxLength, 10), 50) } // Min 10, max 50 characters
  })
}