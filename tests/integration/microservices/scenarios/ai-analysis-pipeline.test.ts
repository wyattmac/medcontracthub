/**
 * AI Analysis Pipeline E2E Test
 * Tests the multi-model AI orchestration and analysis capabilities
 */

import { testSetup, withAuth } from '../setup'

describe('AI Analysis Pipeline E2E', () => {
  beforeAll(async () => {
    await testSetup.waitForServices(['gateway', 'ai', 'app'])
  })

  afterAll(async () => {
    await testSetup.cleanup()
  })

  describe('Opportunity Analysis', () => {
    it('should analyze opportunity with multi-model ensemble', async () => {
      await withAuth(async (token) => {
        const gateway = testSetup.getHttpClient('gateway')
        
        // Create test opportunity data
        const opportunityData = {
          noticeId: 'TEST-OPP-001',
          title: 'Medical Equipment Procurement',
          description: 'Procurement of advanced MRI machines and diagnostic equipment for federal hospital',
          naicsCode: '339112',
          setAsideType: 'SBA',
          responseDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedValue: 5000000,
          requirements: [
            'FDA approved equipment',
            'Installation and training services',
            '5-year warranty',
            'HIPAA compliant data handling'
          ]
        }

        // Request AI analysis
        const analysisResponse = await gateway.post('/api/ai/analyze/opportunity', opportunityData, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        expect(analysisResponse.status).toBe(200)
        expect(analysisResponse.data).toMatchObject({
          analysisId: expect.any(String),
          winProbability: expect.any(Number),
          strengths: expect.arrayContaining([expect.any(String)]),
          weaknesses: expect.arrayContaining([expect.any(String)]),
          recommendations: expect.arrayContaining([
            expect.objectContaining({
              priority: expect.stringMatching(/high|medium|low/),
              action: expect.any(String),
              rationale: expect.any(String)
            })
          ]),
          competitorAnalysis: expect.objectContaining({
            estimatedCompetitors: expect.any(Number),
            marketPosition: expect.any(String)
          }),
          compliance: expect.objectContaining({
            requiredCertifications: expect.any(Array),
            regulatoryConsiderations: expect.any(Array)
          }),
          modelConsensus: expect.objectContaining({
            agreement: expect.any(Number),
            models: expect.arrayContaining(['claude', 'gpt', 'mistral'])
          })
        })

        // Verify win probability is reasonable
        expect(analysisResponse.data.winProbability).toBeGreaterThanOrEqual(0)
        expect(analysisResponse.data.winProbability).toBeLessThanOrEqual(1)
      })
    }, 30000)

    it('should generate proposal outline based on opportunity', async () => {
      await withAuth(async (token) => {
        const gateway = testSetup.getHttpClient('gateway')
        
        const proposalRequest = {
          opportunityId: 'TEST-OPP-001',
          companyProfile: {
            name: 'MedTech Solutions Inc',
            capabilities: ['Medical device installation', 'Healthcare IT', 'Equipment maintenance'],
            pastPerformance: ['VA Hospital MRI Installation', 'DoD Medical Equipment Contract'],
            certifications: ['ISO 13485', 'FDA Registered']
          }
        }

        const proposalResponse = await gateway.post('/api/ai/generate/proposal-outline', proposalRequest, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        expect(proposalResponse.status).toBe(200)
        expect(proposalResponse.data).toMatchObject({
          outline: expect.objectContaining({
            executiveSummary: expect.any(String),
            technicalApproach: expect.arrayContaining([
              expect.objectContaining({
                section: expect.any(String),
                content: expect.any(String),
                keyPoints: expect.any(Array)
              })
            ]),
            managementApproach: expect.any(String),
            pastPerformance: expect.any(Array),
            pricing: expect.objectContaining({
              strategy: expect.any(String),
              considerations: expect.any(Array)
            })
          }),
          confidence: expect.any(Number),
          suggestedThemes: expect.any(Array)
        })
      })
    }, 30000)
  })

  describe('Semantic Search', () => {
    it('should perform semantic search across opportunities', async () => {
      await withAuth(async (token) => {
        const gateway = testSetup.getHttpClient('gateway')
        
        // First, ensure some opportunities are indexed
        const indexRequests = [
          {
            noticeId: 'SEARCH-TEST-001',
            title: 'Cardiac Monitoring Equipment',
            description: 'Advanced telemetry and ECG monitoring systems for ICU'
          },
          {
            noticeId: 'SEARCH-TEST-002',
            title: 'Laboratory Information System',
            description: 'LIMS software for pathology and diagnostic labs'
          },
          {
            noticeId: 'SEARCH-TEST-003',
            title: 'Surgical Instruments Procurement',
            description: 'Minimally invasive surgical tools and endoscopic equipment'
          }
        ]

        // Index opportunities
        for (const opp of indexRequests) {
          await gateway.post('/api/ai/index/opportunity', opp, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        }

        // Wait for indexing
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Perform semantic search
        const searchResponse = await gateway.post('/api/ai/search', {
          query: 'heart monitoring medical devices for critical care',
          filters: {
            minScore: 0.7
          },
          limit: 10
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        expect(searchResponse.status).toBe(200)
        expect(searchResponse.data.results).toBeInstanceOf(Array)
        expect(searchResponse.data.results.length).toBeGreaterThan(0)
        
        // Should find the cardiac monitoring opportunity as most relevant
        const topResult = searchResponse.data.results[0]
        expect(topResult.noticeId).toBe('SEARCH-TEST-001')
        expect(topResult.score).toBeGreaterThan(0.7)
        expect(topResult.highlights).toBeInstanceOf(Array)
      })
    })
  })

  describe('Learning System', () => {
    it('should track and learn from proposal outcomes', async () => {
      await withAuth(async (token) => {
        const gateway = testSetup.getHttpClient('gateway')
        
        // Submit proposal outcome
        const outcomeData = {
          proposalId: 'PROP-TEST-001',
          opportunityId: 'OPP-TEST-001',
          outcome: 'won',
          score: 95,
          feedback: {
            strengths: ['Strong technical approach', 'Competitive pricing'],
            weaknesses: ['Limited past performance examples'],
            evaluatorComments: 'Excellent understanding of requirements'
          },
          contract: {
            awardedAmount: 4500000,
            period: '5 years'
          }
        }

        const outcomeResponse = await gateway.post('/api/ai/learning/outcome', outcomeData, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        expect(outcomeResponse.status).toBe(200)
        expect(outcomeResponse.data).toMatchObject({
          recorded: true,
          learningPoints: expect.arrayContaining([
            expect.objectContaining({
              category: expect.any(String),
              insight: expect.any(String),
              confidence: expect.any(Number)
            })
          ]),
          updatedMetrics: expect.objectContaining({
            winRate: expect.any(Number),
            avgScore: expect.any(Number),
            strengthPatterns: expect.any(Array)
          })
        })
      })
    })
  })
})