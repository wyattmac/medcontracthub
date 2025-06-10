'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Calendar, Plus, X, Upload, FileText, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { createProposalFormSchema, type CreateProposalFormData } from '@/lib/validation/schemas/proposal-form'
import { AIProposalGenerator } from './ai-proposal-generator'
import { ProposalDocumentAnalyzer } from './proposal-document-analyzer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Opportunity {
  id: string
  title: string
  solicitation_number?: string
  response_deadline: string
  agency: string
}

interface ProposalSection {
  section_type: string
  title: string
  content?: string
  is_required?: boolean
  max_pages?: number
}

interface AttachedDocument {
  id: string
  name: string
  size: number
  type: string
  url?: string
  extractedText?: string
  isProcessing?: boolean
}

interface CreateProposalFormProps {
  opportunity?: Opportunity
  onSubmit: (data: CreateProposalFormData) => void
  isLoading?: boolean
  error?: string
}

const defaultSections: ProposalSection[] = [
  {
    section_type: 'executive_summary',
    title: 'Executive Summary',
    is_required: true,
    max_pages: 2
  },
  {
    section_type: 'technical_approach',
    title: 'Technical Approach',
    is_required: true,
    max_pages: 10
  },
  {
    section_type: 'management_approach',
    title: 'Management Approach',
    is_required: true,
    max_pages: 5
  },
  {
    section_type: 'past_performance',
    title: 'Past Performance',
    is_required: true,
    max_pages: 5
  },
  {
    section_type: 'pricing',
    title: 'Pricing',
    is_required: true,
    max_pages: 3
  },
  {
    section_type: 'certifications',
    title: 'Certifications & Compliance',
    is_required: false,
    max_pages: 2
  }
]

const sectionTypeOptions = [
  { value: 'executive_summary', label: 'Executive Summary' },
  { value: 'technical_approach', label: 'Technical Approach' },
  { value: 'management_approach', label: 'Management Approach' },
  { value: 'past_performance', label: 'Past Performance' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'certifications', label: 'Certifications' },
  { value: 'attachments', label: 'Attachments' },
  { value: 'other', label: 'Other' }
]

export function CreateProposalForm({ 
  opportunity, 
  onSubmit, 
  isLoading = false, 
  error 
}: CreateProposalFormProps) {
  const [newTag, setNewTag] = useState('')
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [activeTab, setActiveTab] = useState('form')
  const [rfpDocumentUrl, setRfpDocumentUrl] = useState<string | undefined>()
  const [rfpDocumentName, setRfpDocumentName] = useState<string | undefined>()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    getValues
  } = useForm<CreateProposalFormData>({
    resolver: zodResolver(createProposalFormSchema),
    defaultValues: {
      title: opportunity ? `Proposal for ${opportunity.title}` : '',
      solicitation_number: opportunity?.solicitation_number || '',
      submission_deadline: opportunity?.response_deadline ? 
        new Date(opportunity.response_deadline).toISOString().split('T')[0] : '',
      total_proposed_price: undefined,
      win_probability: undefined,
      proposal_summary: '',
      notes: '',
      tags: [],
      sections: defaultSections,
      attachedDocuments: []
    }
  })

  const tags = watch('tags')
  const sections = watch('sections')
  const attachedDocuments = watch('attachedDocuments')

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setValue('tags', [...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setValue('tags', tags.filter(tag => tag !== tagToRemove))
  }

  const addSection = () => {
    setValue('sections', [...sections, {
      section_type: 'other',
      title: '',
      content: '',
      is_required: false
    }])
  }

  const updateSection = (index: number, field: keyof ProposalSection, value: any) => {
    const updatedSections = [...sections]
    updatedSections[index] = { ...updatedSections[index], [field]: value }
    setValue('sections', updatedSections)
  }

  const removeSection = (index: number) => {
    setValue('sections', sections.filter((_, i) => i !== index))
  }

  const handleSectionGenerated = (sectionType: string, content: string) => {
    // Find the section index
    const sectionIndex = sections.findIndex(s => s.section_type === sectionType)
    
    if (sectionIndex !== -1) {
      // Update existing section
      updateSection(sectionIndex, 'content', content)
    } else {
      // Add new section
      const sectionConfig = sectionTypeOptions.find(opt => opt.value === sectionType)
      setValue('sections', [...sections, {
        section_type: sectionType,
        title: sectionConfig?.label || sectionType,
        content: content,
        is_required: false
      }])
    }
    
    // Switch back to form tab
    setActiveTab('form')
  }

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploadingDocument(true)
    
    for (const file of Array.from(files)) {
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Add document to state immediately
      const newDocument: AttachedDocument = {
        id: documentId,
        name: file.name,
        size: file.size,
        type: file.type,
        isProcessing: true
      }
      
      setValue('attachedDocuments', [...attachedDocuments, newDocument])

      try {
        // Upload file for OCR processing
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/ocr/upload', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error('Failed to upload document')
        }

        const result = await response.json()
        
        // Update document with OCR results
        setValue('attachedDocuments', 
          getValues('attachedDocuments').map(doc => 
            doc.id === documentId 
              ? { 
                  ...doc, 
                  url: result.data.publicUrl,
                  extractedText: result.data.text,
                  isProcessing: false 
                }
              : doc
          )
        )
        
        // If this is an RFP document, set it for AI generation
        if (file.name.toLowerCase().includes('rfp') || 
            file.name.toLowerCase().includes('solicitation')) {
          setRfpDocumentUrl(result.data.publicUrl)
          setRfpDocumentName(file.name)
        }
      } catch (error) {
        console.error('Document upload failed:', error)
        // Remove failed document
        setValue('attachedDocuments', getValues('attachedDocuments').filter(doc => doc.id !== documentId))
      }
    }
    
    setIsUploadingDocument(false)
    // Reset file input
    event.target.value = ''
  }

  const removeDocument = (documentId: string) => {
    setValue('attachedDocuments', attachedDocuments.filter(doc => doc.id !== documentId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFormSubmit = (data: CreateProposalFormData) => {
    // Filter out incomplete sections and processing documents
    const validData = {
      ...data,
      sections: data.sections.filter(section => section.title.trim() !== ''),
      attachedDocuments: data.attachedDocuments.filter(doc => !doc.isProcessing)
    }
    onSubmit(validData)
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="form">Proposal Form</TabsTrigger>
        <TabsTrigger value="ai" disabled={!opportunity}>
          <Sparkles className="h-4 w-4 mr-1" />
          AI Generator
        </TabsTrigger>
        <TabsTrigger value="documents" disabled={attachedDocuments.length === 0}>
          Document Analysis
        </TabsTrigger>
      </TabsList>

      <TabsContent value="form">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded dark:bg-red-900/20 dark:border-red-800">
              {error}
            </div>
          )}

      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Proposal Title *</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Enter proposal title"
            className={errors.title ? 'border-red-500' : ''}
          />
          {errors.title && (
            <p className="text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="solicitation_number">Solicitation Number</Label>
          <Input
            id="solicitation_number"
            {...register('solicitation_number')}
            placeholder="Enter solicitation number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="submission_deadline">Submission Deadline</Label>
          <Input
            id="submission_deadline"
            type="date"
            {...register('submission_deadline')}
            className={errors.submission_deadline ? 'border-red-500' : ''}
          />
          {errors.submission_deadline && (
            <p className="text-sm text-red-600">{errors.submission_deadline.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_proposed_price">Total Proposed Price ($)</Label>
          <Input
            id="total_proposed_price"
            type="number"
            step="0.01"
            {...register('total_proposed_price', { valueAsNumber: true })}
            placeholder="0.00"
            className={errors.total_proposed_price ? 'border-red-500' : ''}
          />
          {errors.total_proposed_price && (
            <p className="text-sm text-red-600">{errors.total_proposed_price.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="win_probability">Win Probability (%)</Label>
          <Input
            id="win_probability"
            type="number"
            min="0"
            max="100"
            step="1"
            {...register('win_probability', { valueAsNumber: true })}
            placeholder="0-100"
            className={errors.win_probability ? 'border-red-500' : ''}
          />
          {errors.win_probability && (
            <p className="text-sm text-red-600">{errors.win_probability.message}</p>
          )}
        </div>
      </div>

      {/* Proposal Summary */}
      <div className="space-y-2">
        <Label htmlFor="proposal_summary">Proposal Summary</Label>
        <Textarea
          id="proposal_summary"
          {...register('proposal_summary')}
          placeholder="Brief summary of your proposal approach and key value propositions..."
          rows={4}
          className={errors.proposal_summary ? 'border-red-500' : ''}
        />
        {errors.proposal_summary && (
          <p className="text-sm text-red-600">{errors.proposal_summary.message}</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add a tag..."
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <Button type="button" onClick={addTag} size="sm">
            Add
          </Button>
        </div>
        {errors.tags && (
          <p className="text-sm text-red-600">{errors.tags.message}</p>
        )}
      </div>

      {/* Proposal Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Proposal Sections
            <Button type="button" onClick={addSection} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Section
            </Button>
          </CardTitle>
          {errors.sections && (
            <p className="text-sm text-red-600 mt-2">{errors.sections.message}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {sections.map((section, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Section {index + 1}</h4>
                {index >= defaultSections.length && (
                  <Button
                    type="button"
                    onClick={() => removeSection(index)}
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Section Type</Label>
                  <Select
                    value={section.section_type}
                    onValueChange={(value) => updateSection(index, 'section_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sectionTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Section Title</Label>
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(index, 'title', e.target.value)}
                    placeholder="Enter section title"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Max Pages</Label>
                  <Input
                    type="number"
                    min="1"
                    value={section.max_pages || ''}
                    onChange={(e) => updateSection(index, 'max_pages', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`required-${index}`}
                  checked={section.is_required || false}
                  onCheckedChange={(checked) => updateSection(index, 'is_required', checked)}
                />
                <Label htmlFor={`required-${index}`}>Required section</Label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Document Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Document Attachments
            <div className="flex items-center gap-2">
              {isUploadingDocument && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              )}
              <Label htmlFor="document-upload" className="cursor-pointer">
                <Button type="button" size="sm" variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    Upload Documents
                  </span>
                </Button>
              </Label>
              <input
                id="document-upload"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                onChange={handleDocumentUpload}
                className="hidden"
                disabled={isUploadingDocument}
              />
            </div>
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload documents for OCR processing. Supported formats: PDF, Word, images (JPG, PNG), TXT
          </p>
        </CardHeader>
        <CardContent>
          {attachedDocuments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No documents attached</p>
              <p className="text-xs">Upload documents to extract text and requirements</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attachedDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-sm">{doc.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.size)}
                        {doc.isProcessing && (
                          <span className="ml-2 text-blue-600">Processing OCR...</span>
                        )}
                        {doc.extractedText && (
                          <span className="ml-2 text-green-600">
                            ✓ Text extracted ({doc.extractedText.length} chars)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.isProcessing && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeDocument(doc.id)}
                      className="text-red-600 hover:text-red-700"
                      disabled={doc.isProcessing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Any additional notes or comments..."
          rows={3}
          className={errors.notes ? 'border-red-500' : ''}
        />
        {errors.notes && (
          <p className="text-sm text-red-600">{errors.notes.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? 'Creating Proposal...' : 'Create Proposal'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href="/dashboard/proposals">Cancel</a>
        </Button>
      </div>
    </form>
      </TabsContent>

      <TabsContent value="ai">
        {opportunity && (
          <AIProposalGenerator
            opportunityId={opportunity.id}
            rfpDocumentUrl={rfpDocumentUrl}
            rfpDocumentName={rfpDocumentName}
            onSectionGenerated={handleSectionGenerated}
          />
        )}
      </TabsContent>

      <TabsContent value="documents">
        <ProposalDocumentAnalyzer
          documents={attachedDocuments}
          onAnalysisComplete={(analyses) => {
            // If we have an RFP document, set it for AI generation
            const rfpDoc = attachedDocuments.find(doc => 
              doc.name.toLowerCase().includes('rfp') || 
              doc.name.toLowerCase().includes('solicitation')
            )
            if (rfpDoc && rfpDoc.url) {
              setRfpDocumentUrl(rfpDoc.url)
              setRfpDocumentName(rfpDoc.name)
            }
          }}
        />
      </TabsContent>
    </Tabs>
  )
}