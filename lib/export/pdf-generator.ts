/**
 * PDF Generation Utility
 * Uses React-PDF to generate professional reports
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer'
import { format } from 'date-fns'

// Register fonts (optional - falls back to default fonts)
// Font.register({
//   family: 'Inter',
//   src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
// })

// PDF Styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: 'Helvetica'
  },
  header: {
    marginBottom: 30,
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 20
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 5
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 20
  },
  section: {
    marginBottom: 25
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10,
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 5
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRightWidth: 0,
    borderBottomWidth: 0
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row'
  },
  tableColHeader: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 8
  },
  tableCol: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#e5e7eb',
    padding: 8
  },
  tableCellHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151'
  },
  tableCell: {
    fontSize: 9,
    color: '#4b5563'
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    padding: 15,
    marginBottom: 15,
    borderRadius: 4,
    borderLeft: 3,
    borderLeftColor: '#3b82f6'
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 9,
    borderTop: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 9,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#6b7280'
  },
  opportunityCard: {
    marginBottom: 15,
    padding: 12,
    borderLeft: 3,
    borderLeftColor: '#10b981',
    backgroundColor: '#f9fafb'
  },
  opportunityTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4
  },
  opportunityMeta: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 6
  },
  opportunityDescription: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.4
  }
})

interface IPDFGeneratorOptions {
  includeAnalysis?: boolean
  includeCharts?: boolean
  template?: 'standard' | 'executive' | 'detailed'
}

/**
 * Generate PDF report based on data and format
 */
export async function generatePDFReport(
  data: any,
  reportFormat: 'opportunities' | 'analytics' | 'proposals',
  options: IPDFGeneratorOptions = {}
): Promise<{ buffer: Buffer; filename: string }> {
  
  let document: React.ReactElement

  switch (reportFormat) {
    case 'opportunities':
      document = React.createElement(OpportunitiesReportDocument, { data, options })
      break
    case 'analytics':
      document = React.createElement(AnalyticsReportDocument, { data, options })
      break
    case 'proposals':
      document = React.createElement(ProposalsReportDocument, { data, options })
      break
    default:
      throw new Error('Invalid report format')
  }

  const pdfInstance = pdf(document)
  
  // Convert the PDF to a buffer
  let pdfBuffer: Buffer
  try {
    const stream = await pdfInstance.toBuffer()
    if (Buffer.isBuffer(stream)) {
      pdfBuffer = stream
    } else {
      // Handle ReadableStream case
      const chunks: Buffer[] = []
      const reader = (stream as any).getReader()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(Buffer.from(value))
      }
      
      pdfBuffer = Buffer.concat(chunks)
    }
  } catch (error) {
    // Fallback: use the blob method and convert to buffer
    const blob = await pdfInstance.toBlob()
    const arrayBuffer = await blob.arrayBuffer()
    pdfBuffer = Buffer.from(arrayBuffer)
  }
  
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm')
  const filename = `${reportFormat}-report-${timestamp}.pdf`

  return {
    buffer: pdfBuffer,
    filename
  }
}

/**
 * Opportunities Report PDF Document
 */
const OpportunitiesReportDocument = ({ data, options }: { data: any[], options: IPDFGeneratorOptions }) => (
  React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.logo }, 'MedContractHub'),
        React.createElement(Text, { style: styles.title }, 'Opportunities Report'),
        React.createElement(Text, { style: styles.subtitle }, 
          `Generated on ${format(new Date(), 'PPP')} • ${data.length} opportunities`
        )
      ),

      // Summary Section
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Summary'),
        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between' } },
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryTitle }, 'Total Opportunities'),
            React.createElement(Text, { style: styles.summaryValue }, data.length.toString())
          ),
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryTitle }, 'Saved Opportunities'),
            React.createElement(Text, { style: styles.summaryValue }, 
              data.filter((opp: any) => opp.saved_opportunities?.length > 0).length.toString()
            )
          )
        )
      ),

      // Opportunities List
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Opportunities'),
        ...data.slice(0, 50).map((opportunity: any, index: number) =>
          React.createElement(View, { key: opportunity.id, style: styles.opportunityCard },
            React.createElement(Text, { style: styles.opportunityTitle }, 
              opportunity.title || 'Untitled Opportunity'
            ),
            React.createElement(Text, { style: styles.opportunityMeta },
              `Solicitation: ${opportunity.solicitation_number || 'N/A'} • ` +
              `Deadline: ${opportunity.response_deadline ? format(new Date(opportunity.response_deadline), 'PP') : 'N/A'} • ` +
              `Value: ${opportunity.estimated_value || 'Not specified'}`
            ),
            React.createElement(Text, { style: styles.opportunityDescription },
              opportunity.description ? 
                (opportunity.description.length > 200 ? 
                  opportunity.description.substring(0, 200) + '...' : 
                  opportunity.description
                ) : 'No description available'
            )
          )
        )
      ),

      // Footer
      React.createElement(Text, { style: styles.footer }, 
        'Generated by MedContractHub • Federal Contract Opportunities Platform'
      ),
      React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: any) => 
        `Page ${pageNumber} of ${totalPages}`
      })
    )
  )
)

/**
 * Analytics Report PDF Document
 */
const AnalyticsReportDocument = ({ data, options }: { data: any, options: IPDFGeneratorOptions }) => (
  React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.logo }, 'MedContractHub'),
        React.createElement(Text, { style: styles.title }, 'Analytics Report'),
        React.createElement(Text, { style: styles.subtitle }, 
          `Period: ${data.period} • Generated on ${format(new Date(), 'PPP')}`
        )
      ),

      // Summary Statistics
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Key Metrics'),
        React.createElement(View, { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } },
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryTitle }, 'Total Opportunities'),
            React.createElement(Text, { style: styles.summaryValue }, 
              data.summary?.totalOpportunities?.toLocaleString() || '0'
            )
          ),
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryTitle }, 'Saved'),
            React.createElement(Text, { style: styles.summaryValue }, 
              data.summary?.totalSaved?.toLocaleString() || '0'
            )
          ),
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryTitle }, 'AI Analyses'),
            React.createElement(Text, { style: styles.summaryValue }, 
              data.summary?.totalAnalyses?.toLocaleString() || '0'
            )
          ),
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryTitle }, 'Proposals'),
            React.createElement(Text, { style: styles.summaryValue }, 
              data.summary?.totalProposals?.toLocaleString() || '0'
            )
          )
        )
      ),

      // Performance Section
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Performance Summary'),
        React.createElement(Text, { style: { fontSize: 10, color: '#4b5563', marginBottom: 10 } },
          `Activity in the last ${data.period}: ${data.performance?.totalSaved || 0} saved opportunities, ` +
          `${data.performance?.totalAnalyses || 0} AI analyses generated.`
        )
      ),

      // Footer
      React.createElement(Text, { style: styles.footer }, 
        'Generated by MedContractHub • Business Intelligence Dashboard'
      ),
      React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: any) => 
        `Page ${pageNumber} of ${totalPages}`
      })
    )
  )
)

/**
 * Proposals Report PDF Document
 */
const ProposalsReportDocument = ({ data, options }: { data: any[], options: IPDFGeneratorOptions }) => (
  React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.logo }, 'MedContractHub'),
        React.createElement(Text, { style: styles.title }, 'Proposals Report'),
        React.createElement(Text, { style: styles.subtitle }, 
          `Generated on ${format(new Date(), 'PPP')} • ${data.length} proposals`
        )
      ),

      // Summary Section
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Summary'),
        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between' } },
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryTitle }, 'Total Proposals'),
            React.createElement(Text, { style: styles.summaryValue }, data.length.toString())
          ),
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryTitle }, 'Submitted'),
            React.createElement(Text, { style: styles.summaryValue }, 
              data.filter((proposal: any) => proposal.status === 'submitted').length.toString()
            )
          )
        )
      ),

      // Proposals List
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Proposals'),
        ...data.slice(0, 20).map((proposal: any, index: number) =>
          React.createElement(View, { key: proposal.id, style: styles.opportunityCard },
            React.createElement(Text, { style: styles.opportunityTitle }, 
              proposal.title || 'Untitled Proposal'
            ),
            React.createElement(Text, { style: styles.opportunityMeta },
              `Status: ${proposal.status || 'Draft'} • ` +
              `Created: ${format(new Date(proposal.created_at), 'PP')} • ` +
              `Opportunity: ${proposal.opportunities?.title || 'N/A'}`
            )
          )
        )
      ),

      // Footer
      React.createElement(Text, { style: styles.footer }, 
        'Generated by MedContractHub • Proposal Management System'
      ),
      React.createElement(Text, { style: styles.pageNumber, render: ({ pageNumber, totalPages }: any) => 
        `Page ${pageNumber} of ${totalPages}`
      })
    )
  )
)