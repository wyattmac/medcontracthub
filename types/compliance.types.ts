/**
 * Compliance Matrix Types
 * Types for Section L/M compliance tracking functionality
 */

import { Database } from './database.types'

// Base database types
export type ComplianceMatrix = Database['public']['Tables']['compliance_matrices']['Row']
export type ComplianceMatrixInsert = Database['public']['Tables']['compliance_matrices']['Insert']
export type ComplianceMatrixUpdate = Database['public']['Tables']['compliance_matrices']['Update']

export type ComplianceRequirement = Database['public']['Tables']['compliance_requirements']['Row']
export type ComplianceRequirementInsert = Database['public']['Tables']['compliance_requirements']['Insert']
export type ComplianceRequirementUpdate = Database['public']['Tables']['compliance_requirements']['Update']

export type ComplianceResponse = Database['public']['Tables']['compliance_responses']['Row']
export type ComplianceResponseInsert = Database['public']['Tables']['compliance_responses']['Insert']
export type ComplianceResponseUpdate = Database['public']['Tables']['compliance_responses']['Update']

// Enums
export enum ComplianceMatrixStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export enum RequirementSection {
  L = 'L', // Instructions to Offerors
  M = 'M', // Evaluation Criteria
  C = 'C', // Contract Clauses
  OTHER = 'Other'
}

export enum RequirementType {
  SUBMISSION = 'submission',
  EVALUATION = 'evaluation',
  TECHNICAL = 'technical',
  ADMINISTRATIVE = 'administrative',
  PAST_PERFORMANCE = 'past_performance',
  PRICING = 'pricing'
}

export enum ResponseStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NOT_APPLICABLE = 'not_applicable',
  DEFERRED = 'deferred'
}

// Extended types with relationships
export interface ComplianceMatrixWithDetails extends ComplianceMatrix {
  opportunity?: Database['public']['Tables']['opportunities']['Row']
  requirements?: ComplianceRequirementWithResponse[]
  total_requirements?: number
  completed_requirements?: number
  completion_percentage?: number
}

export interface ComplianceRequirementWithResponse extends ComplianceRequirement {
  response?: ComplianceResponse
  children?: ComplianceRequirementWithResponse[]
  parent?: ComplianceRequirement
}

export interface ComplianceResponseWithDetails extends ComplianceResponse {
  requirement?: ComplianceRequirement
  assigned_user?: Database['public']['Tables']['users']['Row']
}

// API request/response types
export interface ExtractComplianceRequest {
  opportunity_id: string
  document_url: string
  document_type?: 'rfp' | 'rfi' | 'rfq' | 'sources_sought'
  sections_to_extract?: RequirementSection[]
}

export interface ExtractComplianceResponse {
  matrix_id: string
  requirements: ParsedRequirement[]
  extraction_metadata: {
    total_pages: number
    sections_found: RequirementSection[]
    extraction_confidence: number
    processing_time_ms: number
  }
}

export interface ParsedRequirement {
  section: RequirementSection
  requirement_number: string
  requirement_text: string
  requirement_type?: RequirementType
  page_reference?: string
  is_mandatory: boolean
  children?: ParsedRequirement[]
  confidence_score?: number
}

// Export functionality types
export interface ComplianceMatrixExport {
  matrix: ComplianceMatrix
  requirements: ComplianceRequirementWithResponse[]
  export_date: string
  export_format: 'excel' | 'pdf' | 'csv'
  include_responses: boolean
  include_notes: boolean
}

// Filter and search types
export interface ComplianceMatrixFilters {
  status?: ComplianceMatrixStatus[]
  opportunity_id?: string
  created_after?: Date
  created_before?: Date
  search?: string
}

export interface ComplianceRequirementFilters {
  matrix_id: string
  sections?: RequirementSection[]
  types?: RequirementType[]
  is_mandatory?: boolean
  response_status?: ResponseStatus[]
  assigned_to?: string
  search?: string
}

// Analytics types
export interface ComplianceMatrixAnalytics {
  matrix_id: string
  total_requirements: number
  requirements_by_section: Record<RequirementSection, number>
  requirements_by_type: Record<RequirementType, number>
  requirements_by_status: Record<ResponseStatus, number>
  mandatory_vs_optional: {
    mandatory: number
    optional: number
  }
  completion_rate: number
  overdue_requirements: number
  average_completion_time_hours?: number
}