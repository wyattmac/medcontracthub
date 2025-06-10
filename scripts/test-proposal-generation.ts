#!/usr/bin/env npx ts-node

/**
 * Test script for AI Proposal Generation
 * Tests the backend API directly
 */

import dotenv from 'dotenv'
import { RFPDocumentProcessor } from '../lib/ai/rfp-document-processor'
import { ProposalIntelligenceService } from '../lib/ai/proposal-intelligence-service'
import type { ProcessedRFPDocument, RFPStructure, RFPAnalysisResult } from '../types/rfp.types'
import type { ProposalGenerationRequest } from '../lib/ai/proposal-intelligence-service'

dotenv.config({ path: '.env.local' })

async function testProposalGeneration() {
  console.log('🧪 Testing AI Proposal Generation System\n')

  try {
    // Initialize services
    const rfpProcessor = new RFPDocumentProcessor()
    const intelligenceService = new ProposalIntelligenceService()

    // Test 1: RFP Document Processing
    console.log('Test 1: Processing mock RFP document...')
    const mockRFPText = `
      SECTION L - INSTRUCTIONS TO OFFERORS
      
      L-1 PROPOSAL SUBMISSION
      Proposals shall be submitted in three volumes:
      Volume I - Technical Approach (30 pages max)
      Volume II - Management Approach (20 pages max)
      Volume III - Past Performance (15 pages max)
      
      L-2 TECHNICAL APPROACH
      The offeror shall describe their technical approach to providing medical supplies.
      
      SECTION M - EVALUATION FACTORS
      
      M-1 EVALUATION CRITERIA
      1. Technical Approach (40%)
      2. Management Approach (30%)
      3. Past Performance (20%)
      4. Price (10%)
    `

    // Extract sections
    const sectionL = await rfpProcessor.extractSection(mockRFPText, 'L')
    const sectionM = await rfpProcessor.extractSection(mockRFPText, 'M')

    const processedRFP: ProcessedRFPDocument = {
      id: 'test_rfp_001',
      fileName: 'test-rfp.pdf',
      extractedText: mockRFPText,
      sections: [
        ...(sectionL ? [sectionL] : []),
        ...(sectionM ? [sectionM] : [])
      ],
      metadata: {
        pageCount: 5,
        processingTime: Date.now(),
        extractionMethod: 'ocr',
        confidence: 95
      }
    }

    // Extract RFP structure
    const rfpStructure: RFPStructure = {
      sections: {
        L: sectionL ? {
          subsections: [],
          generalInstructions: sectionL.content,
          formatRequirements: []
        } : undefined,
        M: sectionM ? {
          factors: [],
          evaluationApproach: 'best-value'
        } : undefined
      },
      keyDates: {
        proposalDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      },
      volumes: [
        { 
          volumeNumber: 1,
          name: 'Technical Approach', 
          pageLimit: 30,
          sections: ['technical'],
          format: {
            fileType: ['PDF'],
            compressionAllowed: false
          },
          required: true
        },
        { 
          volumeNumber: 2,
          name: 'Management Approach', 
          pageLimit: 20,
          sections: ['management'],
          format: {
            fileType: ['PDF'],
            compressionAllowed: false
          },
          required: true
        },
        { 
          volumeNumber: 3,
          name: 'Past Performance', 
          pageLimit: 15,
          sections: ['past_performance'],
          format: {
            fileType: ['PDF'],
            compressionAllowed: false
          },
          required: true
        }
      ],
      pageLimit: await rfpProcessor.extractPageLimits(mockRFPText),
      submissionRequirements: await rfpProcessor.extractSubmissionRequirements(mockRFPText),
      metadata: {
        agency: 'DEPT OF DEFENSE',
        contractType: 'supply',
        solicitationNumber: 'TEST-2025-001',
        title: 'Medical Supplies Test',
        naicsCodes: ['339112'],
        setAsides: []
      }
    }

    console.log('✅ RFP Structure extracted successfully')
    console.log('  - Sections found:', Object.keys(rfpStructure.sections).filter(k => rfpStructure.sections[k]))
    console.log('  - Volumes:', rfpStructure.volumes.length)
    console.log('  - Page limits detected:', JSON.stringify(rfpStructure.pageLimit))

    // Test 2: RFP Analysis
    console.log('\nTest 2: Analyzing RFP for proposal insights...')
    const rfpAnalysis = await intelligenceService.analyzeRFPForProposal(
      processedRFP,
      rfpStructure
    )

    console.log('✅ RFP Analysis completed')
    console.log('  - Compliance requirements:', rfpAnalysis.complianceRequirements.length)
    console.log('  - Evaluation insights:', rfpAnalysis.evaluationInsights.length)
    console.log('  - Risks identified:', rfpAnalysis.risks.length)
    console.log('  - Opportunities found:', rfpAnalysis.opportunities.length)

    // Test 3: Generate Proposal Section
    console.log('\nTest 3: Generating Executive Summary...')
    const companyProfile: ProposalGenerationRequest['companyProfile'] = {
      capabilities: [
        'Medical device distribution',
        'Supply chain management',
        'FDA compliance expertise'
      ],
      certifications: [
        'ISO 9001:2015',
        'ISO 13485:2016',
        'Woman-Owned Small Business'
      ],
      naicsCodes: ['339112', '423450'],
      pastPerformance: [
        {
          contract: 'VA Medical Supply Contract',
          value: 5000000,
          description: 'Provided comprehensive medical supply distribution services to 12 VA hospitals',
          relevance: 'Direct experience with government medical supply contracts'
        },
        {
          contract: 'DoD Medical Equipment Delivery',
          value: 3000000,
          description: 'Delivered critical medical equipment to military facilities worldwide',
          relevance: 'Demonstrated capability in time-sensitive medical logistics'
        }
      ]
    }

    const proposalResult = await intelligenceService.generateProposalSection({
      rfpDocument: processedRFP,
      rfpStructure,
      companyProfile,
      proposalSection: 'executive_summary'
    })

    console.log('✅ Executive Summary generated')
    console.log('  - Word count:', proposalResult.sectionContent.wordCount)
    console.log('  - Win themes:', proposalResult.winThemes.length)
    console.log('  - Discriminators:', proposalResult.discriminators.length)
    console.log('  - Compliance score:', 
      Math.round((proposalResult.complianceChecklist.filter(i => i.addressed).length / 
      proposalResult.complianceChecklist.length) * 100) + '%'
    )

    // Display sample content
    console.log('\n📄 Sample Generated Content:')
    console.log('----------------------------')
    console.log(proposalResult.sectionContent.content.substring(0, 500) + '...')
    console.log('----------------------------')

    // Test 4: Win Themes
    console.log('\nTest 4: Generating Win Themes...')
    const winThemes = await intelligenceService.generateWinThemes(
      rfpAnalysis,
      companyProfile
    )

    console.log('✅ Win Themes generated:')
    winThemes.forEach((theme, index) => {
      console.log(`  ${index + 1}. ${theme}`)
    })

    console.log('\n🎉 All tests completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('Stack:', error.stack)
    }
  }
}

// Run the test
testProposalGeneration()