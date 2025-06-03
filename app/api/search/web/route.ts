import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler'
import { braveSearchClient } from '@/lib/search/brave-client'
import { cache } from '@/lib/utils/cache'
import { ValidationError } from '@/lib/errors/types'

// Schema for search query parameters
const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  count: z.coerce.number().int().min(1).max(20).optional().default(10),
  offset: z.coerce.number().int().min(0).max(9).optional().default(0),
  country: z.string().length(2).optional(),
  search_lang: z.string().optional(),
  freshness: z.enum(['pd', 'pw', 'pm', 'py']).optional(),
  type: z.enum(['general', 'medical_suppliers']).optional().default('general')
})

export const GET = routeHandler.GET(
  async ({ request, user }) => {
    const url = new URL(request.url)
    const searchParams = Object.fromEntries(url.searchParams.entries())

    // Validate query parameters
    const validationResult = searchQuerySchema.safeParse(searchParams)
    if (!validationResult.success) {
      throw new ValidationError(
        validationResult.error.errors.map(e => e.message).join(', ')
      )
    }

    const params = validationResult.data
    const { type, ...searchOptions } = params

    // Create cache key
    const cacheKey = `brave-search:${type}:${JSON.stringify(searchOptions)}`

    // Check cache first
    const cachedResults = await cache.get(cacheKey)
    if (cachedResults) {
      return NextResponse.json({
        data: cachedResults,
        cached: true
      })
    }

    let results

    // Perform search based on type
    if (type === 'medical_suppliers') {
      results = await braveSearchClient.searchMedicalSuppliers(
        params.q,
        searchOptions
      )
    } else {
      const response = await braveSearchClient.webSearch(searchOptions)
      results = response.web?.results || []
    }

    // Cache results for 1 hour
    await cache.set(cacheKey, results, 3600)

    return NextResponse.json({
      data: results,
      cached: false,
      query: params.q,
      count: results.length,
      type
    })
  },
  {
    requireAuth: true,
    validateQuery: searchQuerySchema
  }
)