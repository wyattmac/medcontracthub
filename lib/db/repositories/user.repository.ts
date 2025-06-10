/**
 * User Repository
 * 
 * Handles all database operations for user profiles,
 * preferences, and authentication-related data
 * 
 * Uses Context7-based patterns for Supabase integration
 * Reference: /supabase/supabase - user profile patterns
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { BaseRepository } from './base.repository'
import { NotFoundError, ValidationError } from '@/lib/errors/types'
import { startSpan } from '@/lib/monitoring/performance'
import { z } from 'zod'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export interface UserProfile extends ProfileRow {
  company?: {
    id: string
    name: string
    subscription_plan: string
    subscription_status: string
  }
  preferences?: UserPreferences
  stats?: UserStats
}

export interface UserPreferences {
  email_notifications: {
    opportunity_matches: boolean
    deadline_reminders: boolean
    weekly_summary: boolean
    proposal_updates: boolean
  }
  ui_preferences: {
    theme: 'light' | 'dark' | 'system'
    compact_view: boolean
    default_opportunity_view: 'list' | 'grid'
  }
  search_preferences: {
    default_naics_codes: string[]
    default_set_asides: string[]
    default_agencies: string[]
    saved_searches: Array<{
      name: string
      params: Record<string, any>
    }>
  }
}

export interface UserStats {
  opportunities_viewed: number
  opportunities_saved: number
  proposals_created: number
  analyses_performed: number
  last_active: string
}

export interface UserOnboardingData {
  full_name?: string
  phone?: string
  title?: string
  department?: string
  notification_preferences?: Partial<UserPreferences['email_notifications']>
}

const userPreferencesSchema = z.object({
  email_notifications: z.object({
    opportunity_matches: z.boolean().default(true),
    deadline_reminders: z.boolean().default(true),
    weekly_summary: z.boolean().default(true),
    proposal_updates: z.boolean().default(true)
  }).default({}),
  ui_preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    compact_view: z.boolean().default(false),
    default_opportunity_view: z.enum(['list', 'grid']).default('list')
  }).default({}),
  search_preferences: z.object({
    default_naics_codes: z.array(z.string()).default([]),
    default_set_asides: z.array(z.string()).default([]),
    default_agencies: z.array(z.string()).default([]),
    saved_searches: z.array(z.object({
      name: z.string(),
      params: z.record(z.any())
    })).default([])
  }).default({})
})

export class UserRepository extends BaseRepository<'profiles', ProfileRow, ProfileInsert, ProfileUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'profiles')
  }

  /**
   * Get user profile with company and preferences
   */
  async findByIdWithDetails(userId: string): Promise<UserProfile | null> {
    const span = startSpan('UserRepository.findByIdWithDetails')
    
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          companies!profiles_company_id_fkey(
            id,
            name,
            subscription_plan,
            subscription_status
          )
        `)
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw this.handleError(error, 'findByIdWithDetails', { userId })
      }

      // Parse preferences
      let preferences: UserPreferences | undefined
      if (data.preferences) {
        try {
          preferences = userPreferencesSchema.parse(data.preferences)
        } catch (e) {
          this.logger.warn('Invalid user preferences format', { userId })
          preferences = userPreferencesSchema.parse({})
        }
      }

      // Get user stats
      const stats = await this.getUserStats(userId)

      const profile: UserProfile = {
        ...data,
        company: (data as any).companies,
        preferences,
        stats
      }

      span?.setStatus('ok')
      return profile
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Create or update user profile during onboarding
   */
  async upsertFromAuth(
    userId: string,
    email: string,
    metadata?: {
      full_name?: string
      avatar_url?: string
    }
  ): Promise<ProfileRow> {
    const span = startSpan('UserRepository.upsertFromAuth')
    
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .upsert({
          id: userId,
          email,
          full_name: metadata?.full_name || '',
          avatar_url: metadata?.avatar_url,
          preferences: userPreferencesSchema.parse({})
        }, {
          onConflict: 'id'
        })
        .select()
        .single()

      if (error) {
        throw this.handleError(error, 'upsertFromAuth', { userId, email })
      }

      this.logger.info('User profile upserted from auth', { userId, email })

      span?.setStatus('ok')
      return data
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Update user profile during onboarding
   */
  async updateOnboarding(
    userId: string,
    data: UserOnboardingData,
    companyId?: string
  ): Promise<ProfileRow> {
    const span = startSpan('UserRepository.updateOnboarding')
    
    try {
      // Build update object
      const updates: ProfileUpdate = {
        ...(data.full_name && { full_name: data.full_name }),
        ...(data.phone && { phone: data.phone }),
        ...(data.title && { title: data.title }),
        ...(data.department && { department: data.department }),
        ...(companyId && { company_id: companyId }),
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString()
      }

      // Update preferences if provided
      if (data.notification_preferences) {
        const currentProfile = await this.findById(userId)
        const currentPrefs = currentProfile?.preferences 
          ? userPreferencesSchema.parse(currentProfile.preferences)
          : userPreferencesSchema.parse({})

        updates.preferences = {
          ...currentPrefs,
          email_notifications: {
            ...currentPrefs.email_notifications,
            ...data.notification_preferences
          }
        }
      }

      const updated = await super.update(userId, updates)

      this.logger.info('User onboarding updated', { userId, hasCompany: !!companyId })

      span?.setStatus('ok')
      return updated
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<ProfileRow> {
    const span = startSpan('UserRepository.updatePreferences')
    
    try {
      // Get current preferences
      const currentProfile = await this.findById(userId)
      if (!currentProfile) {
        throw new NotFoundError('User profile not found')
      }

      const currentPrefs = currentProfile.preferences 
        ? userPreferencesSchema.parse(currentProfile.preferences)
        : userPreferencesSchema.parse({})

      // Merge preferences
      const mergedPrefs: UserPreferences = {
        email_notifications: {
          ...currentPrefs.email_notifications,
          ...(preferences.email_notifications || {})
        },
        ui_preferences: {
          ...currentPrefs.ui_preferences,
          ...(preferences.ui_preferences || {})
        },
        search_preferences: {
          ...currentPrefs.search_preferences,
          ...(preferences.search_preferences || {})
        }
      }

      // Validate merged preferences
      const validated = userPreferencesSchema.parse(mergedPrefs)

      const updated = await super.update(userId, { preferences: validated })

      this.logger.info('User preferences updated', { userId })

      span?.setStatus('ok')
      return updated
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get all users for a company
   */
  async findByCompany(companyId: string): Promise<ProfileRow[]> {
    const span = startSpan('UserRepository.findByCompany')
    
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })

      if (error) {
        throw this.handleError(error, 'findByCompany', { companyId })
      }

      span?.setStatus('ok')
      return data || []
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Update user role
   */
  async updateRole(
    userId: string,
    role: 'owner' | 'admin' | 'member'
  ): Promise<ProfileRow> {
    const span = startSpan('UserRepository.updateRole')
    
    try {
      const updated = await super.update(userId, { role })

      this.logger.info('User role updated', { userId, role })

      span?.setStatus('ok')
      return updated
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Track user activity
   */
  async trackActivity(
    userId: string,
    activity: {
      type: 'opportunity_view' | 'opportunity_save' | 'proposal_create' | 'analysis_perform'
      metadata?: Record<string, any>
    }
  ): Promise<void> {
    const span = startSpan('UserRepository.trackActivity')
    
    try {
      // Update last activity timestamp
      await super.update(userId, { 
        last_activity_at: new Date().toISOString() 
      })

      // Log activity for analytics
      this.logger.info('User activity tracked', {
        userId,
        activityType: activity.type,
        metadata: activity.metadata
      })

      span?.setStatus('ok')
    } catch (error) {
      span?.setStatus('error')
      // Don't throw - activity tracking shouldn't break the app
      this.logger.error('Failed to track user activity', error, { userId, activity })
    } finally {
      span?.finish()
    }
  }

  /**
   * Get user statistics
   */
  private async getUserStats(userId: string): Promise<UserStats> {
    try {
      // Get counts from various tables
      const [opportunities, proposals, analyses, lastActivity] = await Promise.all([
        this.supabase
          .from('saved_opportunities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        this.supabase
          .from('proposals')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        this.supabase
          .from('opportunity_analyses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        this.supabase
          .from('profiles')
          .select('last_activity_at')
          .eq('id', userId)
          .single()
      ])

      return {
        opportunities_viewed: 0, // Would need tracking implementation
        opportunities_saved: opportunities.count || 0,
        proposals_created: proposals.count || 0,
        analyses_performed: analyses.count || 0,
        last_active: lastActivity.data?.last_activity_at || new Date().toISOString()
      }
    } catch (error) {
      this.logger.error('Failed to get user stats', error, { userId })
      return {
        opportunities_viewed: 0,
        opportunities_saved: 0,
        proposals_created: 0,
        analyses_performed: 0,
        last_active: new Date().toISOString()
      }
    }
  }

  /**
   * Search users by name or email
   */
  async search(companyId: string, query: string): Promise<ProfileRow[]> {
    const span = startSpan('UserRepository.search')
    
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('company_id', companyId)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(20)

      if (error) {
        throw this.handleError(error, 'search', { companyId, query })
      }

      span?.setStatus('ok')
      return data || []
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Get users with specific notification preferences
   */
  async findByNotificationPreference(
    preference: keyof UserPreferences['email_notifications'],
    value = true
  ): Promise<ProfileRow[]> {
    const span = startSpan('UserRepository.findByNotificationPreference')
    
    try {
      // This requires a more complex query since preferences is JSONB
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .filter(`preferences->email_notifications->>${preference}`, 'eq', value)

      if (error) {
        throw this.handleError(error, 'findByNotificationPreference', { preference, value })
      }

      span?.setStatus('ok')
      return data || []
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Find user by ID with company details
   */
  async findByIdWithCompany(userId: string): Promise<UserProfile | null> {
    const span = startSpan('UserRepository.findByIdWithCompany')
    
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          companies (
            id,
            name,
            subscription_plan,
            subscription_status
          )
        `)
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw this.handleError(error, 'findByIdWithCompany', { userId })
      }

      span?.setStatus('ok')
      return data as UserProfile
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Find user by email address
   */
  async findByEmail(email: string): Promise<ProfileRow | null> {
    const span = startSpan('UserRepository.findByEmail')
    
    try {
      const normalizedEmail = email.toLowerCase()
      
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('email', normalizedEmail)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw this.handleError(error, 'findByEmail', { email: normalizedEmail })
      }

      span?.setStatus('ok')
      return data
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }

  /**
   * Update user onboarding status
   */
  async updateOnboardingStatus(userId: string, completed: boolean): Promise<ProfileRow> {
    const span = startSpan('UserRepository.updateOnboardingStatus')
    
    try {
      const updates: ProfileUpdate = {
        onboarding_completed: completed,
        ...(completed && { onboarding_completed_at: new Date().toISOString() })
      }

      const updated = await this.update(userId, updates)

      span?.setStatus('ok')
      return updated
    } catch (error) {
      span?.setStatus('error')
      throw error
    } finally {
      span?.finish()
    }
  }
}