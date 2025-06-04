/**
 * Usage Tracking System
 * Monitors and enforces usage limits for different features
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getRedisClient, isRedisAvailable } from '@/lib/redis/client'
import { planLimits } from '@/lib/stripe/client'
import { apiLogger } from '@/lib/errors/logger'
import { RateLimitError } from '@/lib/errors/types'

export type TrackedFeature = 
  | 'opportunities_view'
  | 'ai_analysis'
  | 'ocr_document'
  | 'export_data'
  | 'email_sent'
  | 'api_call'

interface UsageRecord {
  feature: TrackedFeature
  quantity: number
  metadata?: Record<string, any>
}

interface UsageLimit {
  limit: number
  period: 'day' | 'month'
  used: number
  remaining: number
  resetsAt: Date
}

/**
 * Track feature usage
 */
export async function trackUsage(
  userId: string,
  feature: TrackedFeature,
  quantity: number = 1,
  metadata?: Record<string, any>
): Promise<void> {
  const supabase = createServiceClient()

  // Record in database
  const { error } = await supabase
    .from('usage_records')
    .insert({
      user_id: userId,
      feature,
      quantity,
      metadata: metadata || {}
    })

  if (error) {
    apiLogger.error('Failed to track usage', error, {
      userId,
      feature,
      quantity
    })
  }

  // Also track in Redis for fast access
  if (await isRedisAvailable()) {
    try {
      const redis = getRedisClient()
      const monthKey = `usage:${userId}:${feature}:month:${getMonthKey()}`
      const dayKey = `usage:${userId}:${feature}:day:${getDayKey()}`

      // Increment counters
      await redis.incrby(monthKey, quantity)
      await redis.incrby(dayKey, quantity)

      // Set expiration
      await redis.expire(monthKey, 60 * 60 * 24 * 31) // 31 days
      await redis.expire(dayKey, 60 * 60 * 24) // 24 hours
    } catch (error) {
      apiLogger.error('Failed to track usage in Redis', error as Error)
    }
  }
}

/**
 * Check if user can use a feature
 */
export async function checkUsageLimit(
  userId: string,
  feature: TrackedFeature,
  quantity: number = 1
): Promise<UsageLimit> {
  const supabase = createServiceClient()

  // Get user's subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('user_id', userId)
    .eq('status', ['active', 'trialing'])
    .single()

  if (!subscription) {
    throw new RateLimitError('No active subscription', 0)
  }

  // Get plan details
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('name, limits')
    .eq('id', subscription.plan_id)
    .single()

  const planName = plan?.name?.toLowerCase() || 'starter'
  const limits = planLimits[planName as keyof typeof planLimits] || planLimits.starter

  // Get feature limit
  const featureKey = getFeatureLimitKey(feature)
  const monthlyLimit = limits[featureKey as keyof typeof limits] as number

  // Unlimited check
  if (monthlyLimit === -1) {
    return {
      limit: -1,
      period: 'month',
      used: 0,
      remaining: -1,
      resetsAt: getMonthEnd()
    }
  }

  // Get current usage
  const currentUsage = await getCurrentUsage(userId, feature)

  const remaining = monthlyLimit - currentUsage
  if (remaining < quantity) {
    throw new RateLimitError(
      `${feature} limit exceeded. Upgrade your plan for more.`,
      monthlyLimit
    )
  }

  return {
    limit: monthlyLimit,
    period: 'month',
    used: currentUsage,
    remaining,
    resetsAt: getMonthEnd()
  }
}

/**
 * Get current usage for a feature
 */
async function getCurrentUsage(
  userId: string,
  feature: TrackedFeature
): Promise<number> {
  // Try Redis first
  if (await isRedisAvailable()) {
    try {
      const redis = getRedisClient()
      const monthKey = `usage:${userId}:${feature}:month:${getMonthKey()}`
      const usage = await redis.get(monthKey)
      if (usage !== null) {
        return parseInt(usage, 10)
      }
    } catch (error) {
      apiLogger.error('Failed to get usage from Redis', error as Error)
    }
  }

  // Fallback to database
  const supabase = createServiceClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('usage_records')
    .select('quantity')
    .eq('user_id', userId)
    .eq('feature', feature)
    .gte('created_at', startOfMonth.toISOString())

  if (error) {
    apiLogger.error('Failed to get usage from database', error)
    return 0
  }

  const total = data?.reduce((sum, record) => sum + record.quantity, 0) || 0

  // Cache in Redis
  if (await isRedisAvailable()) {
    try {
      const redis = getRedisClient()
      const monthKey = `usage:${userId}:${feature}:month:${getMonthKey()}`
      await redis.set(monthKey, total, 'EX', 60 * 60 * 24 * 31)
    } catch (error) {
      apiLogger.error('Failed to cache usage in Redis', error as Error)
    }
  }

  return total
}

/**
 * Get usage summary for a user
 */
export async function getUsageSummary(
  userId: string
): Promise<Record<TrackedFeature, UsageLimit>> {
  const supabase = createServiceClient()

  // Get user's subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('user_id', userId)
    .eq('status', ['active', 'trialing'])
    .single()

  if (!subscription) {
    throw new Error('No active subscription')
  }

  // Get plan details
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('name')
    .eq('id', subscription.plan_id)
    .single()

  const planName = plan?.name?.toLowerCase() || 'starter'
  const limits = planLimits[planName as keyof typeof planLimits] || planLimits.starter

  // Get usage for all features
  const features: TrackedFeature[] = [
    'opportunities_view',
    'ai_analysis',
    'ocr_document',
    'export_data',
    'email_sent',
    'api_call'
  ]

  const summary: Record<string, UsageLimit> = {}

  for (const feature of features) {
    const featureKey = getFeatureLimitKey(feature)
    const limit = limits[featureKey as keyof typeof limits] as number
    const used = await getCurrentUsage(userId, feature)

    summary[feature] = {
      limit,
      period: 'month',
      used,
      remaining: limit === -1 ? -1 : Math.max(0, limit - used),
      resetsAt: getMonthEnd()
    }
  }

  return summary as Record<TrackedFeature, UsageLimit>
}

/**
 * Reset usage counters (for testing or manual reset)
 */
export async function resetUsage(
  userId: string,
  feature?: TrackedFeature
): Promise<void> {
  if (await isRedisAvailable()) {
    try {
      const redis = getRedisClient()
      
      if (feature) {
        // Reset specific feature
        const monthKey = `usage:${userId}:${feature}:month:${getMonthKey()}`
        const dayKey = `usage:${userId}:${feature}:day:${getDayKey()}`
        await redis.del(monthKey, dayKey)
      } else {
        // Reset all features
        const pattern = `usage:${userId}:*`
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      }
    } catch (error) {
      apiLogger.error('Failed to reset usage in Redis', error as Error)
    }
  }
}

/**
 * Get feature limit key mapping
 */
function getFeatureLimitKey(feature: TrackedFeature): string {
  const mapping: Record<TrackedFeature, string> = {
    opportunities_view: 'opportunities_per_month',
    ai_analysis: 'ai_analyses_per_month',
    ocr_document: 'ocr_documents_per_month',
    export_data: 'export_formats', // Special case
    email_sent: 'email_alerts', // Special case
    api_call: 'api_access' // Special case
  }
  return mapping[feature]
}

/**
 * Get current month key
 */
function getMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Get current day key
 */
function getDayKey(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

/**
 * Get end of current month
 */
function getMonthEnd(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Middleware to check usage before allowing access
 */
export async function withUsageCheck<T>(
  userId: string,
  feature: TrackedFeature,
  quantity: number = 1,
  fn: () => Promise<T>
): Promise<T> {
  // Check limit first
  await checkUsageLimit(userId, feature, quantity)

  try {
    // Execute the function
    const result = await fn()

    // Track usage after successful execution
    await trackUsage(userId, feature, quantity)

    return result
  } catch (error) {
    // Don't track usage if the operation failed
    throw error
  }
}