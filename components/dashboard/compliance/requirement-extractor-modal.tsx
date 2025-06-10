'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileText, AlertCircle } from 'lucide-react'
import { RequirementSection } from '@/types/compliance.types'
import { useToast } from '@/components/ui/use-toast'

interface RequirementExtractorModalProps {
  open: boolean
  onClose: () => void
  onExtract: (documentUrl: string, sections: RequirementSection[]) => void
  opportunityId: string
}

interface Attachment {
  id: string
  name: string
  url: string
  size: number
  type: string
}

export function RequirementExtractorModal({
  open,
  onClose,
  onExtract,
  opportunityId
}: RequirementExtractorModalProps) {
  const { toast } = useToast()
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [selectedDocument, setSelectedDocument] = useState<string>('')
  const [selectedSections, setSelectedSections] = useState<RequirementSection[]>([
    RequirementSection.L,
    RequirementSection.M
  ])
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false)

  useEffect(() => {
    if (open && opportunityId) {
      fetchAttachments()
    }
  }, [open, opportunityId])

  const fetchAttachments = async () => {
    setIsLoadingAttachments(true)
    try {
      // First get the opportunity to get the notice_id
      const oppResponse = await fetch(`/api/opportunities/${opportunityId}`)
      if (!oppResponse.ok) {
        throw new Error('Failed to fetch opportunity details')
      }
      const oppData = await oppResponse.json()
      const noticeId = oppData.data?.notice_id
      
      if (!noticeId) {
        throw new Error('No notice ID found for this opportunity')
      }
      
      // Then fetch attachments using notice_id
      const response = await fetch(`/api/sam-gov/attachments?noticeId=${noticeId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch attachments')
      }
      
      const data = await response.json()
      const attachmentList = data.data?.attachments || []
      
      // Transform attachments to expected format
      const transformedAttachments = attachmentList.map((att: any) => ({
        id: att.filename,
        name: att.title || att.filename,
        url: att.url,
        size: 0, // Size not provided by API
        type: att.filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
      }))
      
      setAttachments(transformedAttachments)
      
      // Auto-select first attachment
      if (transformedAttachments.length > 0) {
        setSelectedDocument(transformedAttachments[0].url)
      }
    } catch (error) {
      toast({
        title: 'Error loading attachments',
        description: 'Failed to load opportunity attachments. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingAttachments(false)
    }
  }

  const handleSectionToggle = (section: RequirementSection) => {
    setSelectedSections(prev => {
      if (prev.includes(section)) {
        return prev.filter(s => s !== section)
      }
      return [...prev, section]
    })
  }

  const handleExtract = () => {
    if (!selectedDocument) {
      toast({
        title: 'No document selected',
        description: 'Please select a document to extract requirements from.',
        variant: 'destructive'
      })
      return
    }

    if (selectedSections.length === 0) {
      toast({
        title: 'No sections selected',
        description: 'Please select at least one section to extract.',
        variant: 'destructive'
      })
      return
    }

    onExtract(selectedDocument, selectedSections)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="requirement-extractor-modal">
        <DialogHeader>
          <DialogTitle>Extract Compliance Requirements</DialogTitle>
          <DialogDescription>
            Select an RFP document and the sections you want to extract requirements from.
            Our AI will identify and structure all compliance requirements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Document Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Select Document</Label>
            
            {isLoadingAttachments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : attachments.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No attachments found for this opportunity. 
                  Please ensure the opportunity has RFP documents attached.
                </AlertDescription>
              </Alert>
            ) : (
              <RadioGroup 
                value={selectedDocument} 
                onValueChange={setSelectedDocument}
                className="space-y-2"
                data-testid="document-list"
              >
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value={attachment.url} id={attachment.id} />
                    <Label 
                      htmlFor={attachment.id} 
                      className="flex-1 cursor-pointer flex items-center gap-2"
                      data-testid="document-item"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{attachment.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {(attachment.size / 1024 / 1024).toFixed(2)} MB • {attachment.type}
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>

          {/* Section Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Sections to Extract</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="section-l"
                  checked={selectedSections.includes(RequirementSection.L)}
                  onCheckedChange={() => handleSectionToggle(RequirementSection.L)}
                />
                <Label htmlFor="section-l" className="cursor-pointer">
                  <span className="font-medium">Section L</span> - Instructions, Conditions, and Notices to Offerors
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="section-m"
                  checked={selectedSections.includes(RequirementSection.M)}
                  onCheckedChange={() => handleSectionToggle(RequirementSection.M)}
                />
                <Label htmlFor="section-m" className="cursor-pointer">
                  <span className="font-medium">Section M</span> - Evaluation Factors for Award
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="section-c"
                  checked={selectedSections.includes(RequirementSection.C)}
                  onCheckedChange={() => handleSectionToggle(RequirementSection.C)}
                />
                <Label htmlFor="section-c" className="cursor-pointer">
                  <span className="font-medium">Section C</span> - Description/Specifications/Statement of Work
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="section-other"
                  checked={selectedSections.includes(RequirementSection.OTHER)}
                  onCheckedChange={() => handleSectionToggle(RequirementSection.OTHER)}
                />
                <Label htmlFor="section-other" className="cursor-pointer">
                  <span className="font-medium">Other Sections</span> - Additional compliance requirements
                </Label>
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Extraction typically takes 30-60 seconds depending on document size. 
              The AI will identify hierarchical requirements and their relationships.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleExtract}
            disabled={!selectedDocument || selectedSections.length === 0 || isLoadingAttachments}
            data-testid="start-extraction"
          >
            Extract Requirements
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}