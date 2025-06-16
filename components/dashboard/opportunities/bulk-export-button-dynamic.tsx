/**
 * Dynamic Bulk Export Button Component
 * Lazy loads Excel functionality only when needed
 */

'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'

// Loading component for export functionality
const ExportLoading = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
    <span className="ml-2 text-sm text-muted-foreground">Loading export...</span>
  </div>
)

// Dynamically import the full export component only when needed
const BulkExportDialog = dynamic(
  () => import('./bulk-export-button').then(mod => ({ default: mod.BulkExportButton })),
  {
    loading: () => <ExportLoading />,
    ssr: false
  }
)

interface IBulkExportButtonDynamicProps {
  selectedOpportunities?: string[]
  filters?: any
  totalCount: number
  onExport?: (type: 'pdf' | 'excel', options: any) => void
}

export function BulkExportButtonDynamic(props: IBulkExportButtonDynamicProps) {
  const [showExportDialog, setShowExportDialog] = useState(false)

  // Simple dropdown that triggers dynamic loading
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export to Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Export to PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Only load the full export component when needed */}
      {showExportDialog && (
        <BulkExportDialog {...props} />
      )}
    </>
  )
}