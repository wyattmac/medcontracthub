/**
 * Compliance Requirements Extractor
 * Extracts and parses Section L/M requirements from RFP documents
 */

import { mistralDocumentOCR } from '@/lib/ai/mistral-document-ocr-client'
import { Anthropic } from '@anthropic-ai/sdk'
import { 
  RequirementSection, 
  RequirementType, 
  ParsedRequirement, 
  ExtractComplianceResponse 
} from '@/types/compliance.types'
import { logger } from '@/lib/errors/logger'
import { startSpan } from '@/lib/monitoring/performance'

interface ExtractorOptions {
  document_url: string
  document_type: 'rfp' | 'rfi' | 'rfq' | 'sources_sought'
  sections: RequirementSection[]
  opportunity_context?: {
    id: string
    title: string
    notice_id: string
  }
}

export class ComplianceExtractor {
  private ocrClient = mistralDocumentOCR
  private anthropic: Anthropic

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })
  }

  async extractRequirements(options: ExtractorOptions): Promise<ExtractComplianceResponse> {
    return startSpan('compliance.extract', async () => {
      const startTime = Date.now()
      
      try {
        // Step 1: Extract text from document using OCR
        logger.info('Starting compliance extraction', {
          document_url: options.document_url,
          sections: options.sections
        })

        let ocrResult: any

        // Handle mock attachments for development/testing
        if (options.document_url.includes('/mock-attachments/')) {
          logger.info('Using mock data for development')
          
          // Extract opportunity ID from URL if present
          const opportunityId = options.opportunity_context?.id || 'test-opportunity'
          
          ocrResult = {
            success: true,
            data: {
              text: this.getMockRFPText(opportunityId),
              pages: [
                { pageNumber: 1, text: 'Section L - Instructions to Offerors' },
                { pageNumber: 2, text: 'Section M - Evaluation Criteria' }
              ]
            }
          }
        } else {
          ocrResult = await this.ocrClient.processDocument({
            url: options.document_url,
            extractionType: 'compliance_requirements',
            options: {
              preserve_formatting: true,
              extract_tables: true,
              page_numbers: true
            }
          })
        }

        if (!ocrResult.success || !ocrResult.data) {
          throw new Error('OCR extraction failed')
        }

        // Step 2: Parse requirements using Claude
        const requirements = await this.parseRequirementsWithAI({
          text: ocrResult.data.text,
          sections: options.sections,
          document_type: options.document_type,
          pages: ocrResult.data.pages || []
        })

        // Step 3: Post-process and structure requirements
        const structuredRequirements = this.structureRequirements(requirements)

        const processingTime = Date.now() - startTime

        return {
          matrix_id: '', // Will be set by the API endpoint
          requirements: structuredRequirements,
          extraction_metadata: {
            total_pages: ocrResult.data.total_pages || 0,
            sections_found: this.identifySectionsFound(structuredRequirements),
            extraction_confidence: this.calculateConfidence(structuredRequirements),
            processing_time_ms: processingTime
          }
        }
      } catch (error) {
        logger.error('Compliance extraction failed', { error, options })
        throw error
      }
    })
  }

  private async parseRequirementsWithAI(params: {
    text: string
    sections: RequirementSection[]
    document_type: string
    pages: any[]
  }): Promise<ParsedRequirement[]> {
    const sectionDescriptions = {
      L: 'Section L - Instructions, Conditions, and Notices to Offerors',
      M: 'Section M - Evaluation Factors for Award',
      C: 'Section C - Description/Specifications/Statement of Work',
      Other: 'Other relevant sections'
    }

    const prompt = `You are an expert at analyzing government RFP documents and extracting compliance requirements.

Analyze the following ${params.document_type.toUpperCase()} document and extract all requirements from the requested sections.

Sections to extract: ${params.sections.map(s => sectionDescriptions[s]).join(', ')}

For each requirement found, provide:
1. Section (L, M, C, or Other)
2. Requirement number (e.g., L.1, L.1.2, M.1.1.1)
3. Full requirement text
4. Requirement type (submission, evaluation, technical, administrative, past_performance, or pricing)
5. Page reference where found
6. Whether it's mandatory (look for "shall", "must", "required") or optional ("may", "should", "encouraged")
7. Any child requirements (for hierarchical requirements)

Document text:
${params.text}

Respond with a JSON array of requirements following this structure:
{
  "requirements": [
    {
      "section": "L",
      "requirement_number": "L.1",
      "requirement_text": "The offeror shall submit...",
      "requirement_type": "submission",
      "page_reference": "Page 15",
      "is_mandatory": true,
      "confidence_score": 0.95,
      "children": []
    }
  ]
}`

    const response = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 8192,
      temperature: 0.1, // Low temperature for accuracy
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    try {
      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response format')
      }

      // Extract JSON from the response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      return parsed.requirements || []
    } catch (error) {
      logger.error('Failed to parse AI response', { error, response: response.content })
      throw new Error('Failed to parse compliance requirements')
    }
  }

  private structureRequirements(requirements: ParsedRequirement[]): ParsedRequirement[] {
    // Sort by requirement number
    const sorted = requirements.sort((a, b) => {
      return this.compareRequirementNumbers(a.requirement_number, b.requirement_number)
    })

    // Build hierarchy based on requirement numbers
    const structured: ParsedRequirement[] = []
    const requirementMap = new Map<string, ParsedRequirement>()

    for (const req of sorted) {
      requirementMap.set(req.requirement_number, req)
      
      // Find parent requirement
      const parentNumber = this.getParentRequirementNumber(req.requirement_number)
      if (parentNumber && requirementMap.has(parentNumber)) {
        const parent = requirementMap.get(parentNumber)!
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(req)
      } else {
        // Top-level requirement
        structured.push(req)
      }
    }

    return structured
  }

  private compareRequirementNumbers(a: string, b: string): number {
    const partsA = a.split(/[.\-]/).map(p => p.replace(/\D/g, '')).filter(Boolean).map(Number)
    const partsB = b.split(/[.\-]/).map(p => p.replace(/\D/g, '')).filter(Boolean).map(Number)

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0
      const numB = partsB[i] || 0
      if (numA !== numB) {
        return numA - numB
      }
    }

    return 0
  }

  private getParentRequirementNumber(requirementNumber: string): string | null {
    const parts = requirementNumber.split(/[.\-]/)
    if (parts.length <= 1) {
      return null
    }

    // Remove the last part to get the parent
    parts.pop()
    return parts.join('.')
  }

  private identifySectionsFound(requirements: ParsedRequirement[]): RequirementSection[] {
    const sections = new Set<RequirementSection>()
    
    const addSections = (reqs: ParsedRequirement[]) => {
      for (const req of reqs) {
        sections.add(req.section)
        if (req.children) {
          addSections(req.children)
        }
      }
    }

    addSections(requirements)
    return Array.from(sections)
  }

  private calculateConfidence(requirements: ParsedRequirement[]): number {
    if (requirements.length === 0) return 0

    let totalConfidence = 0
    let count = 0

    const calculateConfidenceRecursive = (reqs: ParsedRequirement[]) => {
      for (const req of reqs) {
        if (req.confidence_score !== undefined) {
          totalConfidence += req.confidence_score
          count++
        }
        if (req.children) {
          calculateConfidenceRecursive(req.children)
        }
      }
    }

    calculateConfidenceRecursive(requirements)
    return count > 0 ? totalConfidence / count : 0.8 // Default confidence
  }

  private getMockRFPText(opportunityId: string = 'test'): string {
    return `
SECTION L - INSTRUCTIONS, CONDITIONS, AND NOTICES TO OFFERORS

L.1 SUBMISSION REQUIREMENTS
L.1.1 All proposals shall be submitted electronically via SAM.gov no later than the date and time specified.
L.1.2 Technical proposals shall not exceed 50 pages, excluding resumes and past performance documentation.
L.1.3 Price proposals shall be submitted separately and clearly identify all labor categories and rates.

L.2 TECHNICAL PROPOSAL FORMAT
L.2.1 Executive Summary (Maximum 2 pages)
L.2.2 Technical Approach (Maximum 20 pages)
L.2.3 Management Approach (Maximum 10 pages)
L.2.4 Past Performance (Maximum 10 pages)
L.2.5 Key Personnel Resumes (Not included in page count)

L.3 CERTIFICATIONS AND REPRESENTATIONS
L.3.1 Offerors must be registered in SAM.gov at time of proposal submission
L.3.2 Small business certifications must be current and verified
L.3.3 All required certifications must be completed in full

SECTION M - EVALUATION FACTORS FOR AWARD

M.1 EVALUATION CRITERIA
The Government will evaluate proposals based on the following factors listed in descending order of importance:

M.1.1 TECHNICAL CAPABILITY (40 POINTS)
- Understanding of requirements
- Technical approach and methodology
- Innovation and efficiency of proposed solution
- Risk mitigation strategies

M.1.2 PAST PERFORMANCE (30 POINTS)
- Relevance of past contracts
- Quality of performance on similar efforts
- Customer satisfaction ratings
- On-time delivery history

M.1.3 MANAGEMENT APPROACH (20 POINTS)
- Project management methodology
- Key personnel qualifications
- Quality control procedures
- Communication plan

M.1.4 PRICE (10 POINTS)
- Price reasonableness
- Price realism
- Total evaluated price

M.2 MINIMUM REQUIREMENTS
M.2.1 Offerors must demonstrate at least 3 years of experience in similar contracts
M.2.2 Key personnel must possess required certifications
M.2.3 Offerors must have satisfactory past performance ratings

M.3 AWARD BASIS
Award will be made to the offeror whose proposal provides the best value to the Government, considering all evaluation factors.
    `.trim()
  }
}