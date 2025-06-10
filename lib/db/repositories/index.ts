/**
 * Repository Factory
 * 
 * Centralized access point for all database repositories
 * Implements singleton pattern to ensure consistent instances
 * 
 * Uses Context7-based patterns for Supabase integration
 * Reference: /supabase/supabase - client initialization patterns
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { OpportunityRepository } from './opportunity.repository'
import { CompanyRepository } from './company.repository'
import { ProposalRepository } from './proposal.repository'
import { UserRepository } from './user.repository'
import { logger } from '@/lib/errors/logger'

export class RepositoryFactory {
  private static instances = new Map<string, RepositoryFactory>()
  
  private opportunityRepo?: OpportunityRepository
  private companyRepo?: CompanyRepository
  private proposalRepo?: ProposalRepository
  private userRepo?: UserRepository

  private constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Get repository factory instance for server-side usage
   */
  static async getServerInstance(): Promise<RepositoryFactory> {
    const key = 'server'
    
    if (!this.instances.has(key)) {
      const supabase = await createClient()
      this.instances.set(key, new RepositoryFactory(supabase))
      logger.debug('Created server repository factory instance')
    }
    
    return this.instances.get(key)!
  }

  /**
   * Get repository factory instance for client-side usage
   */
  static getClientInstance(): RepositoryFactory {
    const key = 'client'
    
    if (!this.instances.has(key)) {
      const supabase = createBrowserClient()
      this.instances.set(key, new RepositoryFactory(supabase))
      logger.debug('Created client repository factory instance')
    }
    
    return this.instances.get(key)!
  }

  /**
   * Create instance with custom Supabase client
   */
  static createWithClient(supabase: SupabaseClient<Database>): RepositoryFactory {
    return new RepositoryFactory(supabase)
  }

  /**
   * Get Opportunity Repository
   */
  get opportunities(): OpportunityRepository {
    if (!this.opportunityRepo) {
      this.opportunityRepo = new OpportunityRepository(this.supabase)
    }
    return this.opportunityRepo
  }

  /**
   * Get Company Repository
   */
  get companies(): CompanyRepository {
    if (!this.companyRepo) {
      this.companyRepo = new CompanyRepository(this.supabase)
    }
    return this.companyRepo
  }

  /**
   * Get Proposal Repository
   */
  get proposals(): ProposalRepository {
    if (!this.proposalRepo) {
      this.proposalRepo = new ProposalRepository(this.supabase)
    }
    return this.proposalRepo
  }

  /**
   * Get User Repository
   */
  get users(): UserRepository {
    if (!this.userRepo) {
      this.userRepo = new UserRepository(this.supabase)
    }
    return this.userRepo
  }

  /**
   * Clear all repository caches
   */
  clearAllCaches(): void {
    this.companies.clearCache()
    logger.info('All repository caches cleared')
  }

  /**
   * Reset factory instance (useful for testing)
   */
  static reset(): void {
    this.instances.clear()
    logger.debug('Repository factory instances reset')
  }
}

// Export individual repositories for direct import if needed
export { OpportunityRepository } from './opportunity.repository'
export { CompanyRepository } from './company.repository'
export { ProposalRepository } from './proposal.repository'
export { UserRepository } from './user.repository'
export { BaseRepository } from './base.repository'

// Export types
export type {
  QueryOptions,
  PaginationOptions,
  PaginatedResult,
  TransactionOptions
} from './base.repository'

export type {
  OpportunitySearchParams,
  OpportunitySaveParams,
  OpportunityWithMetadata
} from './opportunity.repository'

export type {
  CompanyWithStats,
  CompanyOnboardingData
} from './company.repository'

export type {
  ProposalWithDetails,
  ProposalCreateData,
  ProposalSearchParams
} from './proposal.repository'

export type {
  UserProfile,
  UserPreferences,
  UserStats,
  UserOnboardingData
} from './user.repository'