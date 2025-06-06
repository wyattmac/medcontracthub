/**
 * Product Matching Engine
 * Matches extracted requirements to supplier products using AI and fuzzy matching
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { claude } from '@/lib/ai/claude-client'
import { costOptimizer } from '@/lib/ai/cost-optimizer'
import { aiLogger } from '@/lib/errors/logger'
// import Fuse from 'fuse.js' // TODO: Install fuse.js dependency

interface IProductRequirement {
  id: string
  productName: string
  specifications: Record<string, any>
  quantity: number
  unit: string
  requiredCertifications: string[]
  requiredStandards: string[]
}

interface ISupplierProduct {
  id: string
  supplierId: string
  supplierName: string
  productName: string
  sku: string
  specifications: Record<string, any>
  unitPrice: number
  bulkPricing?: Record<string, number>
  certifications: string[]
  leadTimeDays: number
  minimumOrderQuantity: number
}

interface IMatchResult {
  requirementId: string
  matches: Array<{
    product: ISupplierProduct
    matchScore: number
    priceForQuantity: number
    meetsRequirements: boolean
    missingCertifications: string[]
    matchReasons: string[]
  }>
}

class ProductMatcher {
  private supabase: ReturnType<typeof createClient<Database>>
  private productCache: Map<string, ISupplierProduct[]> = new Map()

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Match requirements to supplier products
   */
  async matchRequirements(
    requirements: IProductRequirement[],
    options: {
      minMatchScore?: number
      maxResultsPerRequirement?: number
      includePricing?: boolean
    } = {}
  ): Promise<IMatchResult[]> {
    const {
      minMatchScore = 0.7,
      maxResultsPerRequirement = 5,
      includePricing = true
    } = options

    const results: IMatchResult[] = []

    for (const requirement of requirements) {
      // Get potential matches using fuzzy search
      const candidates = await this.findCandidateProducts(requirement)

      // Score each candidate
      const scoredMatches = await this.scoreMatches(requirement, candidates)

      // Filter and sort matches
      const topMatches = scoredMatches
        .filter(m => m.matchScore >= minMatchScore)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, maxResultsPerRequirement)

      // Calculate pricing if requested
      if (includePricing) {
        topMatches.forEach(match => {
          match.priceForQuantity = this.calculatePrice(
            match.product,
            requirement.quantity
          )
        })
      }

      results.push({
        requirementId: requirement.id,
        matches: topMatches
      })
    }

    // Track AI usage for cost optimization
    await costOptimizer.trackUsage({
      service: 'claude_ai',
      operation: 'product_matching',
      cost: this.estimateMatchingCost(requirements.length),
      entityType: 'product_requirements',
      entityId: requirements[0]?.id
    })

    return results
  }

  /**
   * Find candidate products using fuzzy search
   */
  private async findCandidateProducts(
    requirement: IProductRequirement
  ): Promise<ISupplierProduct[]> {
    // Check cache first
    const cacheKey = this.generateCacheKey(requirement)
    const cached = this.productCache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Search in product catalog
    const { data: _catalogProducts } = await this.supabase
      .from('product_catalog')
      .select('*')
      .textSearch('product_name', requirement.productName, {
        type: 'websearch',
        config: 'english'
      })
      .limit(20)


    // Fuzzy search on supplier products (simplified without Fuse.js)
    const allProducts = await this.getAllSupplierProducts()
    const candidates = allProducts.filter(product => 
      product.productName.toLowerCase().includes(requirement.productName.toLowerCase())
    )

    // Cache results
    this.productCache.set(cacheKey, candidates)

    return candidates
  }

  /**
   * Score matches using AI and rule-based logic
   */
  private async scoreMatches(
    requirement: IProductRequirement,
    candidates: ISupplierProduct[]
  ): Promise<Array<{
    product: ISupplierProduct
    matchScore: number
    priceForQuantity: number
    meetsRequirements: boolean
    missingCertifications: string[]
    matchReasons: string[]
  }>> {
    const scoredMatches = []

    for (const candidate of candidates) {
      // Rule-based scoring
      const certificationScore = this.scoreCertifications(
        requirement.requiredCertifications,
        candidate.certifications
      )

      const specificationScore = this.scoreSpecifications(
        requirement.specifications,
        candidate.specifications
      )

      // AI-based semantic matching for complex requirements
      const semanticScore = await this.getSemanticMatchScore(
        requirement,
        candidate
      )

      // Calculate composite score
      const matchScore = (
        certificationScore * 0.4 +
        specificationScore * 0.3 +
        semanticScore * 0.3
      )

      // Check missing certifications
      const missingCertifications = requirement.requiredCertifications.filter(
        cert => !candidate.certifications.includes(cert)
      )

      // Determine if meets requirements
      const meetsRequirements = missingCertifications.length === 0 &&
        candidate.minimumOrderQuantity <= requirement.quantity

      // Generate match reasons
      const matchReasons = this.generateMatchReasons(
        requirement,
        candidate,
        { certificationScore, specificationScore, semanticScore }
      )

      scoredMatches.push({
        product: candidate,
        matchScore,
        priceForQuantity: 0, // Will be calculated later
        meetsRequirements,
        missingCertifications,
        matchReasons
      })
    }

    return scoredMatches
  }

  /**
   * Score certification matches
   */
  private scoreCertifications(
    required: string[],
    available: string[]
  ): number {
    if (required.length === 0) return 1

    const matches = required.filter(cert => 
      available.some(avail => 
        avail.toLowerCase().includes(cert.toLowerCase())
      )
    )

    return matches.length / required.length
  }

  /**
   * Score specification matches
   */
  private scoreSpecifications(
    required: Record<string, any>,
    available: Record<string, any>
  ): number {
    const requiredKeys = Object.keys(required)
    if (requiredKeys.length === 0) return 1

    let matchCount = 0
    for (const key of requiredKeys) {
      if (available[key] && this.specificationMatches(required[key], available[key])) {
        matchCount++
      }
    }

    return matchCount / requiredKeys.length
  }

  /**
   * Check if specifications match
   */
  private specificationMatches(required: any, available: any): boolean {
    // Handle different types of specifications
    if (typeof required === 'string' && typeof available === 'string') {
      return available.toLowerCase().includes(required.toLowerCase())
    }

    if (typeof required === 'number' && typeof available === 'number') {
      // Allow 10% tolerance for numeric specifications
      return Math.abs(required - available) / required <= 0.1
    }

    return required === available
  }

  /**
   * Get semantic match score using AI
   */
  private async getSemanticMatchScore(
    requirement: IProductRequirement,
    candidate: ISupplierProduct
  ): Promise<number> {
    try {
      // Use cached AI analysis if available
      const cacheKey = `semantic_${requirement.id}_${candidate.id}`
      const cached = cache.get(cacheKey)
      if (cached) return cached as number

      // Prepare prompt for Claude
      const prompt = `Compare these two products and rate their match from 0 to 1:

Required Product:
- Name: ${requirement.productName}
- Specifications: ${JSON.stringify(requirement.specifications)}
- Certifications: ${requirement.requiredCertifications.join(', ')}

Candidate Product:
- Name: ${candidate.productName}
- Specifications: ${JSON.stringify(candidate.specifications)}
- Certifications: ${candidate.certifications.join(', ')}

Return only a number between 0 and 1.`

      const response = await claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
      const score = parseFloat(response.content[0]?.type === 'text' ? response.content[0].text : '0') || 0

      // Cache result
      cache.set(cacheKey, score, 3600) // 1 hour cache

      return Math.min(Math.max(score, 0), 1) // Ensure 0-1 range
    } catch (error) {
      aiLogger.error('Semantic matching failed', error as Error)
      return 0.5 // Default middle score on error
    }
  }

  /**
   * Calculate price for quantity
   */
  private calculatePrice(
    product: ISupplierProduct,
    quantity: number
  ): number {
    // Check bulk pricing
    if (product.bulkPricing) {
      const quantities = Object.keys(product.bulkPricing)
        .map(Number)
        .sort((a, b) => b - a)

      for (const bulkQty of quantities) {
        if (quantity >= bulkQty) {
          return product.bulkPricing[bulkQty.toString()] * quantity
        }
      }
    }

    // Default unit price
    return product.unitPrice * quantity
  }

  /**
   * Generate human-readable match reasons
   */
  private generateMatchReasons(
    requirement: IProductRequirement,
    candidate: ISupplierProduct,
    scores: {
      certificationScore: number
      specificationScore: number
      semanticScore: number
    }
  ): string[] {
    const reasons: string[] = []

    if (scores.certificationScore === 1) {
      reasons.push('✓ All required certifications met')
    } else if (scores.certificationScore > 0) {
      reasons.push(`⚠️ ${Math.round(scores.certificationScore * 100)}% certifications met`)
    }

    if (scores.specificationScore >= 0.9) {
      reasons.push('✓ Specifications closely match requirements')
    } else if (scores.specificationScore >= 0.7) {
      reasons.push('✓ Good specification match')
    }

    if (scores.semanticScore >= 0.8) {
      reasons.push('✓ High semantic similarity')
    }

    if (candidate.leadTimeDays <= 7) {
      reasons.push('✓ Fast delivery available')
    }

    return reasons
  }

  /**
   * Generate cache key for requirement
   */
  private generateCacheKey(requirement: IProductRequirement): string {
    return `products_${requirement.productName}_${JSON.stringify(requirement.specifications)}`
  }

  /**
   * Get all supplier products (with caching)
   */
  private async getAllSupplierProducts(): Promise<ISupplierProduct[]> {
    const cacheKey = 'all_supplier_products'
    const cached = cache.get(cacheKey)
    if (cached) return cached as ISupplierProduct[]

    const { data } = await this.supabase
      .from('supplier_pricing')
      .select(`
        *,
        supplier_catalog!inner(
          id,
          supplier_name,
          certifications
        )
      `)
      .eq('availability_status', 'in_stock')

    const products: ISupplierProduct[] = (data || []).map(item => ({
      id: item.id,
      supplierId: item.supplier_catalog.id,
      supplierName: item.supplier_catalog.supplier_name,
      productName: item.product_name,
      sku: item.supplier_sku,
      specifications: item.specifications || {},
      unitPrice: Number(item.unit_price),
      bulkPricing: item.bulk_pricing,
      certifications: item.supplier_catalog.certifications || [],
      leadTimeDays: item.lead_time_days || 0,
      minimumOrderQuantity: item.minimum_order_quantity || 1
    }))

    cache.set(cacheKey, products, 300) // 5 minute cache
    return products
  }

  /**
   * Estimate matching cost for budgeting
   */
  private estimateMatchingCost(requirementCount: number): number {
    // Rough estimate: 100 tokens per match * 10 candidates per requirement
    const estimatedTokens = requirementCount * 10 * 100
    return costOptimizer.estimateClaudeCost(estimatedTokens, 50)
  }

  /**
   * Save match results to database
   */
  async saveMatches(matches: IMatchResult[]): Promise<void> {
    const sourcedProducts = []

    for (const result of matches) {
      for (const match of result.matches) {
        sourcedProducts.push({
          requirement_id: result.requirementId,
          supplier_id: match.product.supplierId,
          product_name: match.product.productName,
          product_url: `supplier_${match.product.supplierId}_sku_${match.product.sku}`,
          specifications: match.product.specifications,
          price_per_unit: match.product.unitPrice,
          minimum_order_quantity: match.product.minimumOrderQuantity,
          lead_time_days: match.product.leadTimeDays,
          certifications: match.product.certifications,
          match_score: match.matchScore,
          verification_status: match.meetsRequirements ? 'verified' : 'pending'
        })
      }
    }

    if (sourcedProducts.length > 0) {
      const { error } = await this.supabase
        .from('sourced_products')
        .insert(sourcedProducts)

      if (error) {
        aiLogger.error('Failed to save sourced products', error)
      }
    }
  }
}

// Import cache from utils
import { cache } from '@/lib/utils/cache'

// Export singleton instance
export const productMatcher = new ProductMatcher()

// Export for testing - removed duplicate export