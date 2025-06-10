import { z } from 'zod'
import { uuidSchema } from '../shared-schemas'

// Schema for proposal sections
export const proposalSectionSchema = z.object({
  section_type: z.string().min(1, 'Section type is required'),
  title: z.string().min(1, 'Section title is required').max(200, 'Title must be less than 200 characters'),
  content: z.string().optional(),
  is_required: z.boolean().optional().default(false),
  max_pages: z.number().positive('Page limit must be positive').optional()
})

// Schema for attached documents
export const attachedDocumentSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Document name is required'),
  size: z.number().positive('File size must be positive'),
  type: z.string().min(1, 'File type is required'),
  url: z.string().url('Invalid document URL').optional(),
  extractedText: z.string().optional(),
  isProcessing: z.boolean().optional()
})

// Main create proposal form schema
export const createProposalFormSchema = z.object({
  opportunity_id: uuidSchema.optional(), // Will be added separately if provided
  title: z.string().min(1, 'Proposal title is required').max(255, 'Title must be less than 255 characters'),
  solicitation_number: z.string().optional(),
  submission_deadline: z.string().optional().refine((val) => {
    if (!val) return true
    const date = new Date(val)
    return !isNaN(date.getTime()) && date > new Date()
  }, 'Submission deadline must be a future date'),
  total_proposed_price: z.number().positive('Price must be positive').optional().or(z.literal('')),
  win_probability: z.number().min(0, 'Probability must be at least 0').max(100, 'Probability must be at most 100').optional().or(z.literal('')),
  proposal_summary: z.string().max(2000, 'Summary must be less than 2000 characters').optional(),
  notes: z.string().max(5000, 'Notes must be less than 5000 characters').optional(),
  tags: z.array(z.string().max(50, 'Tag must be less than 50 characters')).max(20, 'Maximum 20 tags allowed').optional().default([]),
  sections: z.array(proposalSectionSchema).min(1, 'At least one section is required'),
  attachedDocuments: z.array(attachedDocumentSchema).max(10, 'Maximum 10 documents allowed').optional().default([])
})

// Type inference
export type CreateProposalFormData = z.infer<typeof createProposalFormSchema>