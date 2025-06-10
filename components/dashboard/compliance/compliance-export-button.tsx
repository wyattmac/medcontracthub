'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { ComplianceMatrixWithDetails } from '@/types/compliance.types'

interface ComplianceExportButtonProps {
  matrix: ComplianceMatrixWithDetails
}

export function ComplianceExportButton({ matrix }: ComplianceExportButtonProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'csv' | null>(null)

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    setIsExporting(true)
    setExportFormat(format)

    try {
      const response = await fetch(`/api/compliance/export/${matrix.id}?format=${format}`, {
        method: 'GET',
        headers: {
          'Accept': format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                   format === 'pdf' ? 'application/pdf' : 'text/csv'
        }
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      const fileNameMatch = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const fileName = fileNameMatch ? fileNameMatch[1].replace(/['"]/g, '') : 
                      `compliance-matrix-${matrix.id.slice(0, 8)}.${format === 'excel' ? 'xlsx' : format}`

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: 'Export Successful',
        description: `Compliance matrix exported as ${format.toUpperCase()}`
      })
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export compliance matrix. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsExporting(false)
      setExportFormat(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting} data-testid="export-button">
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="export-options">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => handleExport('excel')}
          disabled={isExporting}
          data-format="excel"
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (.xlsx)
          {exportFormat === 'excel' && isExporting && (
            <Loader2 className="h-3 w-3 ml-auto animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          data-format="pdf"
        >
          <FileText className="h-4 w-4 mr-2" />
          PDF Document
          {exportFormat === 'pdf' && isExporting && (
            <Loader2 className="h-3 w-3 ml-auto animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          data-format="csv"
        >
          <FileText className="h-4 w-4 mr-2" />
          CSV File
          {exportFormat === 'csv' && isExporting && (
            <Loader2 className="h-3 w-3 ml-auto animate-spin" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}