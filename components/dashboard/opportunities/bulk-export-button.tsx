/**
 * Bulk Export Button Component
 * Allows users to export selected or filtered opportunities
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Download, FileText, FileSpreadsheet, Settings } from 'lucide-react'

interface IBulkExportButtonProps {
  selectedOpportunities?: string[]
  filters?: any
  totalCount: number
  onExport?: (type: 'pdf' | 'excel', options: any) => void
}

export function BulkExportButton({ 
  selectedOpportunities = [], 
  filters, 
  totalCount,
  onExport 
}: IBulkExportButtonProps) {
  const [showOptions, setShowOptions] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    includeAnalysis: false,
    includeCharts: false,
    template: 'standard' as 'standard' | 'executive' | 'detailed'
  })

  const handleExport = async (type: 'pdf' | 'excel') => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          format: 'opportunities',
          filters: {
            ...filters,
            opportunityIds: selectedOpportunities.length > 0 ? selectedOpportunities : undefined
          },
          options: exportOptions
        }),
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `opportunities-${type}-${Date.now()}.${type === 'pdf' ? 'pdf' : 'xlsx'}`

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // Call callback if provided
      onExport?.(type, exportOptions)
    } catch (error) {
      console.error('Export failed:', error)
      // TODO: Show error toast
    }
  }

  const exportCount = selectedOpportunities.length > 0 ? selectedOpportunities.length : totalCount

  return (
    <div className="flex items-center gap-2">
      {/* Quick Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export {exportCount > 0 && `(${exportCount})`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleExport('pdf')}>
            <FileText className="mr-2 h-4 w-4" />
            Export as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('excel')}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export as Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Advanced Export Options */}
      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Options</DialogTitle>
            <DialogDescription>
              Customize your export with additional data and formatting options.
              {selectedOpportunities.length > 0 
                ? `Exporting ${selectedOpportunities.length} selected opportunities.`
                : `Exporting all ${totalCount} filtered opportunities.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Include Analysis */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeAnalysis"
                checked={exportOptions.includeAnalysis}
                onCheckedChange={(checked) =>
                  setExportOptions(prev => ({ ...prev, includeAnalysis: checked as boolean }))
                }
              />
              <Label htmlFor="includeAnalysis" className="text-sm">
                Include AI analysis data (if available)
              </Label>
            </div>

            {/* Include Charts */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeCharts"
                checked={exportOptions.includeCharts}
                onCheckedChange={(checked) =>
                  setExportOptions(prev => ({ ...prev, includeCharts: checked as boolean }))
                }
              />
              <Label htmlFor="includeCharts" className="text-sm">
                Include charts and visualizations (PDF only)
              </Label>
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Report Template</Label>
              <div className="space-y-2">
                {[
                  { value: 'standard', label: 'Standard', description: 'Basic information and data' },
                  { value: 'executive', label: 'Executive', description: 'Summary focused for leadership' },
                  { value: 'detailed', label: 'Detailed', description: 'Comprehensive data and analysis' }
                ].map((template) => (
                  <div key={template.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={template.value}
                      checked={exportOptions.template === template.value}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setExportOptions(prev => ({ ...prev, template: template.value as any }))
                        }
                      }}
                    />
                    <div>
                      <Label htmlFor={template.value} className="text-sm font-medium">
                        {template.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={() => {
                  handleExport('pdf')
                  setShowOptions(false)
                }}
                className="flex-1"
              >
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
              <Button 
                onClick={() => {
                  handleExport('excel')
                  setShowOptions(false)
                }}
                variant="outline"
                className="flex-1"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}