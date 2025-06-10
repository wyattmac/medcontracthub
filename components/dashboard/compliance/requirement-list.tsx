'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  ChevronRight, 
  ChevronDown, 
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Edit2,
  Save,
  X
} from 'lucide-react'
import { ComplianceRequirementWithResponse, ResponseStatus } from '@/types/compliance.types'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface RequirementListProps {
  matrixId: string
  requirements: ComplianceRequirementWithResponse[]
  viewMode: 'requirements' | 'responses'
  onUpdate?: () => void
}

export function RequirementList({ 
  matrixId, 
  requirements, 
  viewMode,
  onUpdate 
}: RequirementListProps) {
  const { toast } = useToast()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set())

  const toggleExpanded = (requirementId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(requirementId)) {
        next.delete(requirementId)
      } else {
        next.add(requirementId)
      }
      return next
    })
  }

  const toggleEditing = (requirementId: string) => {
    setEditingItems(prev => {
      const next = new Set(prev)
      if (next.has(requirementId)) {
        next.delete(requirementId)
      } else {
        next.add(requirementId)
      }
      return next
    })
  }

  const updateResponseStatus = async (responseId: string, status: ResponseStatus) => {
    setUpdatingItems(prev => new Set(prev).add(responseId))
    
    try {
      const response = await fetch(`/api/compliance/responses/${responseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_status: status })
      })

      if (!response.ok) {
        throw new Error('Failed to update response status')
      }

      toast({
        title: 'Status Updated',
        description: 'Response status has been updated successfully.'
      })

      if (onUpdate) {
        onUpdate()
      }
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update response status. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(responseId)
        return next
      })
    }
  }

  const getStatusIcon = (status: ResponseStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'not_applicable':
        return <XCircle className="h-4 w-4 text-gray-400" />
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
    }
  }

  const getSectionColor = (section: string) => {
    switch (section) {
      case 'L':
        return 'bg-blue-100 text-blue-800'
      case 'M':
        return 'bg-purple-100 text-purple-800'
      case 'C':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const renderRequirement = (requirement: ComplianceRequirementWithResponse, depth = 0) => {
    const hasChildren = requirement.children && requirement.children.length > 0
    const isExpanded = expandedItems.has(requirement.id)
    const isEditing = editingItems.has(requirement.id)
    const isUpdating = updatingItems.has(requirement.response?.id || '')
    
    return (
      <div key={requirement.id} className={cn(depth > 0 && "ml-8")}>
        <Card className="mb-2" data-testid="requirement-item">
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start gap-3">
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => toggleExpanded(requirement.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                )}
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={cn("text-xs", getSectionColor(requirement.section))}
                      data-section={requirement.section}
                    >
                      Section {requirement.section}
                    </Badge>
                    <span className="font-mono text-sm text-muted-foreground">
                      {requirement.requirement_number}
                    </span>
                    {requirement.is_mandatory && (
                      <Badge variant="destructive" className="text-xs">
                        Mandatory
                      </Badge>
                    )}
                    {requirement.page_reference && (
                      <span className="text-xs text-muted-foreground">
                        Page {requirement.page_reference}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm">{requirement.requirement_text}</div>
                </div>

                {viewMode === 'responses' && requirement.response && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={requirement.response.response_status}
                      onValueChange={(value) => updateResponseStatus(requirement.response!.id, value as ResponseStatus)}
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="w-40" data-testid="status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full border-2 border-gray-300" />
                            Not Started
                          </div>
                        </SelectItem>
                        <SelectItem value="in_progress">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-yellow-600" />
                            In Progress
                          </div>
                        </SelectItem>
                        <SelectItem value="completed">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            Completed
                          </div>
                        </SelectItem>
                        <SelectItem value="not_applicable">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-gray-400" />
                            Not Applicable
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleEditing(requirement.id)}
                    >
                      {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>

              {/* Response Details (when editing) */}
              {viewMode === 'responses' && requirement.response && isEditing && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Response Location</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      placeholder="e.g., Volume 1, Section 2.3"
                      defaultValue={requirement.response.response_location || ''}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes</label>
                    <Textarea
                      className="min-h-[80px] text-sm"
                      placeholder="Add any notes about this requirement..."
                      defaultValue={requirement.response.notes || ''}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleEditing(requirement.id)}
                    >
                      Cancel
                    </Button>
                    <Button size="sm">
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div className="mt-2">
            {requirement.children!.map(child => renderRequirement(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (requirements.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No requirements found. Extract requirements from an RFP document to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2" data-testid="requirements-list">
      {requirements.map(requirement => renderRequirement(requirement))}
    </div>
  )
}