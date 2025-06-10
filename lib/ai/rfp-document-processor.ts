/**
 * RFP Document Processor
 * Enhanced Mistral OCR processing specifically for RFP documents
 */

import { MistralDocumentOCRClient } from './mistral-document-ocr-client'
import { 
  RFPStructure, 
  ProcessedRFPDocument, 
  ExtractedSection,
  ExtractedRequirement,
  InstructionSection,
  EvaluationSection,
  ContractClauseSection,
  VolumeRequirement,
  PageLimitations,
  SubmissionRequirements
} from '@/types/rfp.types'
import { logger } from '@/lib/errors/logger'

/**
 * Specialized prompts for RFP extraction
 */
const RFP_EXTRACTION_PROMPTS = {
  STRUCTURE: `Extract the complete structure of this government RFP document. Identify and extract:
1. Section L - Instructions to Offerors (all subsections with numbers and titles)
2. Section M - Evaluation Factors (with weights, points, or importance levels)
3. Section C - Statement of Work / Contract Clauses
4. Section H - Special Contract Requirements
5. Section K - Representations and Certifications
6. Key dates (questions deadline, proposal deadline, oral presentations, etc.)
7. Volume/submission requirements (page limits, format, number of copies)
8. Any unique agency-specific sections

Output as structured JSON with clear hierarchical organization.`,

  SECTION_L: `Extract Section L - Instructions to Offerors. For each subsection include:
- Section number (e.g., L.1, L.2.1)
- Title
- Full text content
- Specific requirements (marked by shall/will/must)
- Whether it's mandatory or optional
- Page/volume limits if specified
- Format requirements
Focus on technical, management, past performance, and pricing instructions.`,

  SECTION_M: `Extract Section M - Evaluation Factors. Include:
- Each evaluation factor and subfactor
- Weights, points, or relative importance
- Evaluation approach (trade-off, LPTA, best value)
- Minimum requirements or thresholds
- Adjectival ratings if specified
- Price vs technical trade-off
Structure hierarchically with clear parent-child relationships.`,

  REQUIREMENTS: `Extract all compliance requirements from this RFP section. For each requirement:
- Quote the exact requirement text
- Identify the type (shall/will/must/should/may)
- Categorize (technical, management, past performance, administrative)
- Note if it's a mandatory vs desired requirement
- Extract any referenced standards or specifications
- Identify verification/proof requirements`,

  KEY_DATES: `Extract all important dates and deadlines:
- Questions submission deadline
- Proposal submission deadline
- Oral presentation dates (if applicable)
- Site visit dates
- Amendment cutoff dates
- Anticipated award date
- Period of performance
Include time zones and specific submission instructions.`,

  PAGE_LIMITS: `Extract all page and volume limitations:
- Total page limit
- Individual volume/section limits
- What counts toward page limit
- What's excluded (covers, tabs, resumes, etc.)
- Font size and margin requirements
- Graphics/charts limitations
- Electronic file size limits`
}

export class RFPDocumentProcessor {
  private ocrClient: MistralDocumentOCRClient

  constructor() {
    this.ocrClient = new MistralDocumentOCRClient()
  }

  /**
   * Process RFP document with specialized extraction
   */
  async processRFPDocument(
    documentUrl: string,
    fileName: string
  ): Promise<ProcessedRFPDocument> {
    try {
      logger.info('Starting RFP document processing', { fileName, documentUrl })

      // Download and extract text
      const extractedText = await this.ocrClient.processDocument(
        documentUrl,
        RFP_EXTRACTION_PROMPTS.STRUCTURE
      )

      // Parse the structured response
      const structure = this.parseRFPStructure(extractedText)

      // Extract sections in detail
      const sections = await this.extractDetailedSections(extractedText, structure)

      // Extract requirements
      const requirements = await this.extractRequirements(sections)

      const processedDoc: ProcessedRFPDocument = {
        id: `rfp_${Date.now()}`,
        fileName,
        extractedText,
        sections,
        metadata: {
          pageCount: this.estimatePageCount(extractedText),
          processingTime: Date.now(),
          extractionMethod: 'ocr',
          confidence: this.calculateConfidence(sections)
        }
      }

      logger.info('RFP document processed successfully', {
        fileName,
        sectionsFound: sections.length,
        requirementsFound: requirements.length
      })

      return processedDoc
    } catch (error) {
      logger.error('Error processing RFP document', error as Error, { fileName })
      throw error
    }
  }

  /**
   * Extract specific RFP sections with targeted prompts
   */
  async extractSection(
    documentText: string,
    sectionType: 'L' | 'M' | 'C' | 'H' | 'K'
  ): Promise<ExtractedSection | null> {
    const prompts = {
      L: RFP_EXTRACTION_PROMPTS.SECTION_L,
      M: RFP_EXTRACTION_PROMPTS.SECTION_M,
      C: 'Extract Section C - Statement of Work...',
      H: 'Extract Section H - Special Contract Requirements...',
      K: 'Extract Section K - Representations and Certifications...'
    }

    try {
      const prompt = prompts[sectionType]
      const extraction = await this.ocrClient.extractWithPrompt(documentText, prompt)
      return this.parseExtractedSection(extraction, sectionType)
    } catch (error) {
      logger.warn(`Failed to extract section ${sectionType}`, error as Error)
      return null
    }
  }

  /**
   * Parse RFP structure from extracted text
   */
  private parseRFPStructure(extractedText: string): Partial<RFPStructure> {
    try {
      // Attempt to parse as JSON first
      const parsed = JSON.parse(extractedText)
      return this.normalizeRFPStructure(parsed)
    } catch {
      // Fallback to text parsing
      return this.parseRFPFromText(extractedText)
    }
  }

  /**
   * Extract detailed sections
   */
  private async extractDetailedSections(
    fullText: string,
    structure: Partial<RFPStructure>
  ): Promise<ExtractedSection[]> {
    const sections: ExtractedSection[] = []
    
    // Extract each major section
    for (const sectionKey of ['L', 'M', 'C', 'H', 'K']) {
      const section = await this.extractSection(fullText, sectionKey as any)
      if (section) {
        sections.push(section)
      }
    }

    return sections
  }

  /**
   * Extract all requirements from sections
   */
  private async extractRequirements(
    sections: ExtractedSection[]
  ): Promise<ExtractedRequirement[]> {
    const requirements: ExtractedRequirement[] = []
    
    for (const section of sections) {
      const sectionRequirements = await this.extractSectionRequirements(section)
      requirements.push(...sectionRequirements)
    }

    return requirements
  }

  /**
   * Extract requirements from a specific section
   */
  private async extractSectionRequirements(
    section: ExtractedSection
  ): Promise<ExtractedRequirement[]> {
    const requirements: ExtractedRequirement[] = []
    
    // Extract shall/will/must statements
    const requirementPatterns = [
      /\b(shall|will|must)\s+([^.]+)/gi,
      /\b(required to|requirement|requires)\s+([^.]+)/gi,
      /\b(contractor|offeror)\s+(shall|will|must)\s+([^.]+)/gi
    ]

    for (const pattern of requirementPatterns) {
      const matches = section.content.matchAll(pattern)
      for (const match of matches) {
        requirements.push({
          id: `req_${section.sectionId}_${requirements.length + 1}`,
          text: match[0],
          type: this.classifyRequirementType(match[1]),
          category: this.categorizeRequirement(match[0]),
          references: this.extractReferences(match[0]),
          isCompliance: true
        })
      }
    }

    // Also process subsections
    if (section.subsections) {
      for (const subsection of section.subsections) {
        const subRequirements = await this.extractSectionRequirements(subsection)
        requirements.push(...subRequirements)
      }
    }

    return requirements
  }

  /**
   * Parse evaluation factors with Mistral
   */
  async parseEvaluationFactors(sectionMText: string): Promise<EvaluationSection> {
    const prompt = `Parse the evaluation factors and create a structured breakdown:
    - Identify each factor and subfactor
    - Extract weights or relative importance
    - Determine evaluation approach (trade-off, LPTA, etc.)
    - Note minimum requirements
    - Identify price vs non-price trade-off
    Output as structured JSON.`

    const result = await this.ocrClient.extractWithPrompt(sectionMText, prompt)
    return this.normalizeEvaluationSection(JSON.parse(result))
  }

  /**
   * Extract page limitations and formatting requirements
   */
  async extractPageLimits(documentText: string): Promise<PageLimitations> {
    const result = await this.ocrClient.extractWithPrompt(
      documentText,
      RFP_EXTRACTION_PROMPTS.PAGE_LIMITS
    )
    
    return this.parsePageLimitations(result)
  }

  /**
   * Extract submission requirements
   */
  async extractSubmissionRequirements(
    documentText: string
  ): Promise<SubmissionRequirements> {
    const prompt = `Extract all submission requirements:
    - Delivery method (electronic, hard copy, both)
    - Number of copies required
    - File format requirements
    - Naming conventions
    - Organization/structure requirements
    - Submission deadlines and time zones`

    const result = await this.ocrClient.extractWithPrompt(documentText, prompt)
    return this.parseSubmissionRequirements(result)
  }

  /**
   * Helper methods for parsing and normalization
   */
  private normalizeRFPStructure(parsed: any): Partial<RFPStructure> {
    return {
      sections: {
        L: parsed.sectionL || parsed.instructions,
        M: parsed.sectionM || parsed.evaluation,
        C: parsed.sectionC || parsed.statementOfWork,
        H: parsed.sectionH || parsed.specialRequirements,
        K: parsed.sectionK || parsed.representations
      },
      keyDates: this.parseKeyDates(parsed.dates || parsed.keyDates),
      volumes: parsed.volumes || [],
      pageLimit: parsed.pageLimits || parsed.pageLimit,
      submissionRequirements: parsed.submission || parsed.submissionRequirements
    }
  }

  private parseExtractedSection(
    extraction: string,
    sectionType: string
  ): ExtractedSection {
    // Parse the extraction result and structure it
    const parsed = this.safeJsonParse(extraction)
    
    return {
      sectionId: `section_${sectionType}`,
      sectionNumber: sectionType,
      title: parsed.title || `Section ${sectionType}`,
      content: parsed.content || extraction,
      pageNumbers: parsed.pages || [],
      subsections: this.parseSubsections(parsed.subsections),
      requirements: []
    }
  }

  private parseSubsections(subsections: any[]): ExtractedSection[] {
    if (!Array.isArray(subsections)) return []
    
    return subsections.map((sub, index) => ({
      sectionId: `subsection_${index}`,
      sectionNumber: sub.number || `${index + 1}`,
      title: sub.title || '',
      content: sub.content || '',
      pageNumbers: sub.pages || [],
      requirements: []
    }))
  }

  private classifyRequirementType(
    keyword: string
  ): 'shall' | 'will' | 'must' | 'should' | 'may' {
    const normalized = keyword.toLowerCase()
    if (normalized.includes('shall')) return 'shall'
    if (normalized.includes('will')) return 'will'
    if (normalized.includes('must')) return 'must'
    if (normalized.includes('should')) return 'should'
    if (normalized.includes('may')) return 'may'
    return 'shall' // default
  }

  private categorizeRequirement(text: string): string {
    const lowerText = text.toLowerCase()
    
    if (lowerText.includes('technical') || lowerText.includes('specification')) {
      return 'technical'
    }
    if (lowerText.includes('management') || lowerText.includes('staffing')) {
      return 'management'
    }
    if (lowerText.includes('past performance') || lowerText.includes('experience')) {
      return 'past_performance'
    }
    if (lowerText.includes('price') || lowerText.includes('cost')) {
      return 'pricing'
    }
    if (lowerText.includes('format') || lowerText.includes('submit')) {
      return 'administrative'
    }
    
    return 'general'
  }

  private extractReferences(text: string): string[] {
    const references: string[] = []
    
    // Extract FAR references
    const farPattern = /\bFAR\s+\d+\.\d+/gi
    const farMatches = text.match(farPattern)
    if (farMatches) references.push(...farMatches)
    
    // Extract section references
    const sectionPattern = /\b(Section|Paragraph)\s+[A-Z]\.\d+/gi
    const sectionMatches = text.match(sectionPattern)
    if (sectionMatches) references.push(...sectionMatches)
    
    return references
  }

  private parseKeyDates(dates: any): RFPStructure['keyDates'] {
    return {
      questionsDeadline: dates?.questions ? new Date(dates.questions) : undefined,
      proposalDeadline: new Date(dates?.proposal || dates?.submission || Date.now()),
      oralPresentations: dates?.orals ? new Date(dates.orals) : undefined,
      awardDate: dates?.award ? new Date(dates.award) : undefined
    }
  }

  private parsePageLimitations(result: string): PageLimitations {
    const parsed = this.safeJsonParse(result)
    
    return {
      totalPages: parsed.total || parsed.totalPages,
      volumeLimits: parsed.volumes || parsed.volumeLimits || {},
      excludedFromCount: parsed.excluded || [],
      fontRequirements: {
        size: parsed.fontSize || 12,
        type: parsed.fontTypes || ['Times New Roman', 'Arial']
      }
    }
  }

  private parseSubmissionRequirements(result: string): SubmissionRequirements {
    const parsed = this.safeJsonParse(result)
    
    return {
      deliveryMethod: parsed.method || ['electronic'],
      numberOfCopies: parsed.copies,
      electronicFormat: parsed.formats || ['PDF'],
      namingConvention: parsed.naming,
      organizationRequirements: parsed.organization || [],
      deadlines: {
        questions: parsed.deadlines?.questions,
        proposal: parsed.deadlines?.proposal || new Date(),
        revisions: parsed.deadlines?.revisions
      }
    }
  }

  private normalizeEvaluationSection(parsed: any): EvaluationSection {
    return {
      factors: parsed.factors || [],
      totalPoints: parsed.totalPoints,
      evaluationApproach: parsed.approach || 'best-value',
      priceWeight: parsed.priceWeight
    }
  }

  private parseRFPFromText(text: string): Partial<RFPStructure> {
    // Fallback text parsing logic
    return {
      sections: {},
      keyDates: {
        proposalDeadline: new Date()
      },
      volumes: [],
      pageLimit: {
        fontRequirements: {
          size: 12,
          type: ['Times New Roman']
        },
        volumeLimits: {}
      },
      submissionRequirements: {
        deliveryMethod: ['electronic'],
        organizationRequirements: [],
        deadlines: {
          proposal: new Date()
        }
      }
    }
  }

  private safeJsonParse(text: string): any {
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  }

  private estimatePageCount(text: string): number {
    // Rough estimate: ~3000 characters per page
    return Math.ceil(text.length / 3000)
  }

  private calculateConfidence(sections: ExtractedSection[]): number {
    // Simple confidence calculation based on sections found
    const expectedSections = ['L', 'M', 'C']
    const foundSections = sections.map(s => s.sectionNumber)
    const foundExpected = expectedSections.filter(s => foundSections.includes(s))
    
    return (foundExpected.length / expectedSections.length) * 100
  }
}