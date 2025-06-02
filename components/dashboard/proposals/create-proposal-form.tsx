'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Calendar, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'

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

interface CreateProposalFormProps {
  opportunity?: Opportunity
  onSubmit: (data: any) => void
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
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [sections, setSections] = useState<ProposalSection[]>(defaultSections)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm({
    defaultValues: {
      title: opportunity ? `Proposal for ${opportunity.title}` : '',
      solicitation_number: opportunity?.solicitation_number || '',
      submission_deadline: opportunity?.response_deadline ? 
        new Date(opportunity.response_deadline).toISOString().split('T')[0] : '',
      total_proposed_price: '',
      win_probability: '',
      proposal_summary: '',
      notes: ''
    }
  })

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const addSection = () => {
    setSections([...sections, {
      section_type: 'other',
      title: '',
      content: '',
      is_required: false
    }])
  }

  const updateSection = (index: number, field: keyof ProposalSection, value: any) => {
    const updatedSections = [...sections]
    updatedSections[index] = { ...updatedSections[index], [field]: value }
    setSections(updatedSections)
  }

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index))
  }

  const handleFormSubmit = (data: any) => {
    onSubmit({
      ...data,
      tags,
      sections: sections.filter(section => section.title.trim() !== ''),
      total_proposed_price: data.total_proposed_price ? parseFloat(data.total_proposed_price) : null,
      win_probability: data.win_probability ? parseFloat(data.win_probability) / 100 : null
    })
  }

  return (
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
            {...register('title', { required: 'Title is required' })}
            placeholder="Enter proposal title"
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_proposed_price">Total Proposed Price ($)</Label>
          <Input
            id="total_proposed_price"
            type="number"
            step="0.01"
            {...register('total_proposed_price')}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="win_probability">Win Probability (%)</Label>
          <Input
            id="win_probability"
            type="number"
            min="0"
            max="100"
            step="1"
            {...register('win_probability')}
            placeholder="0-100"
          />
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
        />
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

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Any additional notes or comments..."
          rows={3}
        />
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
  )
}