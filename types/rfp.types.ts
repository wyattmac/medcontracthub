/**
 * RFP Processing Types
 * Types for AI-powered RFP document analysis and proposal generation
 */

/**
 * RFP Document Structure
 */
export interface RFPStructure {
  sections: {
    L?: InstructionSection      // Instructions to Offerors
    M?: EvaluationSection       // Evaluation Criteria
    C?: ContractClauseSection   // Contract Clauses
    H?: SpecialProvisions       // Special Provisions
    K?: RepresentationsSection  // Representations and Certifications
    [key: string]: any          // Other custom sections
  }
  keyDates: {
    questionsDeadline?: Date
    proposalDeadline: Date
    oralPresentations?: Date
    awardDate?: Date
  }
  volumes: VolumeRequirement[]
  pageLimit: PageLimitations
  submissionRequirements: SubmissionRequirements
  metadata: {
    agency: string
    contractType: string
    solicitationNumber: string
    title: string
    naicsCodes: string[]
    setAsides: string[]
    placeOfPerformance?: {
      state: string
      city?: string
    }
  }
}

/**
 * Section L - Instructions to Offerors
 */
export interface InstructionSection {
  subsections: InstructionSubsection[]
  generalInstructions: string
  technicalInstructions?: string
  managementInstructions?: string
  pastPerformanceInstructions?: string
  pricingInstructions?: string
  formatRequirements: FormatRequirement[]
}

export interface InstructionSubsection {
  number: string
  title: string
  content: string
  requirements: string[]
  isMandatory: boolean
}

/**
 * Section M - Evaluation Criteria
 */
export interface EvaluationSection {
  factors: EvaluationFactor[]
  totalPoints?: number
  evaluationApproach: 'trade-off' | 'lpta' | 'best-value'
  priceWeight?: number
}

export interface EvaluationFactor {
  name: string
  description: string
  weight?: number
  points?: number
  subfactors?: EvaluationFactor[]
  evaluationCriteria: string[]
  minimumRequirements?: string[]
}

/**
 * Section C - Contract Clauses
 */
export interface ContractClauseSection {
  clauses: ContractClause[]
  specialClauses: string[]
  flowDownClauses: string[]
}

export interface ContractClause {
  number: string
  title: string
  text: string
  isFlowDown: boolean
  category: 'standard' | 'special' | 'agency-specific'
}

/**
 * Section H - Special Contract Requirements
 */
export interface SpecialProvisions {
  securityRequirements?: SecurityRequirement[]
  deliverables: Deliverable[]
  reportingRequirements: ReportingRequirement[]
  qualityRequirements?: string[]
  specialTerms?: string[]
}

/**
 * Section K - Representations and Certifications
 */
export interface RepresentationsSection {
  requiredCertifications: Certification[]
  representations: Representation[]
  smallBusinessRequirements?: SmallBusinessRequirement[]
}

/**
 * Volume and Page Requirements
 */
export interface VolumeRequirement {
  volumeNumber: number
  name: string
  sections: string[]
  pageLimit?: number
  format: DocumentFormat
  required: boolean
}

export interface PageLimitations {
  totalPages?: number
  volumeLimits: {
    [volumeName: string]: number
  }
  excludedFromCount?: string[]
  fontRequirements: {
    size: number
    type: string[]
  }
}

/**
 * Submission Requirements
 */
export interface SubmissionRequirements {
  deliveryMethod: ('electronic' | 'hardcopy' | 'both')[]
  numberOfCopies?: number
  electronicFormat?: string[]
  namingConvention?: string
  organizationRequirements: string[]
  deadlines: {
    questions?: Date
    proposal: Date
    revisions?: Date
  }
}

/**
 * Supporting Types
 */
export interface FormatRequirement {
  element: string
  requirement: string
  isMandatory: boolean
}

export interface SecurityRequirement {
  level: string
  description: string
  personnelRequirements: string[]
  facilityRequirements?: string[]
}

export interface Deliverable {
  id: string
  name: string
  description: string
  dueDate: string
  frequency?: string
  format?: string
}

export interface ReportingRequirement {
  reportType: string
  frequency: string
  format: string
  recipient: string
  contents: string[]
}

export interface Certification {
  name: string
  farClause?: string
  required: boolean
  description: string
}

export interface Representation {
  question: string
  farReference?: string
  required: boolean
  impactOnEvaluation: boolean
}

export interface SmallBusinessRequirement {
  type: string
  percentage?: number
  description: string
  verificationRequired: boolean
}

export interface DocumentFormat {
  fileType: string[]
  maxFileSize?: string
  namingConvention?: string
  compressionAllowed: boolean
}

/**
 * RFP Analysis Results
 */
export interface RFPAnalysisResult {
  structure: RFPStructure
  extractionQuality: {
    confidence: number
    completeness: number
    issues: ExtractionIssue[]
  }
  complianceRequirements: ComplianceRequirement[]
  evaluationInsights: EvaluationInsight[]
  risks: RFPRisk[]
  opportunities: RFPOpportunity[]
}

export interface ExtractionIssue {
  section: string
  issue: string
  severity: 'low' | 'medium' | 'high'
  suggestion?: string
}

export interface ComplianceRequirement {
  id: string
  source: string
  requirement: string
  category: string
  isMandatory: boolean
  verificationMethod: string
  proposalSection?: string
}

export interface EvaluationInsight {
  factor: string
  importance: 'critical' | 'high' | 'medium' | 'low'
  strategy: string
  requiredProofPoints: string[]
  differentiators: string[]
}

export interface RFPRisk {
  description: string
  severity: 'low' | 'medium' | 'high'
  likelihood: 'low' | 'medium' | 'high'
  mitigation: string
  section?: string
}

export interface RFPOpportunity {
  description: string
  section: string
  strategy: string
  competitiveAdvantage: string
}

/**
 * Document Processing Types
 */
export interface ProcessedRFPDocument {
  id: string
  fileName: string
  extractedText: string
  sections: ExtractedSection[]
  metadata: {
    pageCount: number
    processingTime: number
    extractionMethod: 'ocr' | 'text'
    confidence: number
  }
}

export interface ExtractedSection {
  sectionId: string
  sectionNumber: string
  title: string
  content: string
  pageNumbers: number[]
  subsections?: ExtractedSection[]
  requirements: ExtractedRequirement[]
}

export interface ExtractedRequirement {
  id: string
  text: string
  type: 'shall' | 'will' | 'must' | 'should' | 'may'
  category: string
  references: string[]
  isCompliance: boolean
}