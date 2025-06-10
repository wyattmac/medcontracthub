/**
 * RLS Policy Manager
 * 
 * Documents and validates all Row Level Security (RLS) policies
 * Provides utilities for policy validation and testing
 * 
 * Uses Context7-based patterns for Supabase security
 * Reference: /supabase/supabase - RLS implementation patterns
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { logger } from '@/lib/errors/logger'
import { startSpan } from '@/lib/monitoring/performance'

export interface RLSPolicy {
  table: string
  name: string
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL'
  role: 'authenticated' | 'anon' | 'service_role'
  using?: string
  check?: string
  description: string
}

export interface PolicyValidationResult {
  isValid: boolean
  policy: RLSPolicy
  errors: string[]
  warnings: string[]
}

export class RLSPolicyManager {
  // Define all RLS policies for the application
  private static readonly policies: RLSPolicy[] = [
    // Company policies
    {
      table: 'companies',
      name: 'companies_select_own',
      operation: 'SELECT',
      role: 'authenticated',
      using: 'id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can only view their own company'
    },
    {
      table: 'companies',
      name: 'companies_update_own',
      operation: 'UPDATE',
      role: 'authenticated',
      using: 'id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN (\'owner\', \'admin\'))',
      description: 'Only company owners and admins can update company details'
    },

    // Profile policies
    {
      table: 'profiles',
      name: 'profiles_select_own',
      operation: 'SELECT',
      role: 'authenticated',
      using: 'id = auth.uid() OR company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can view their own profile and profiles in their company'
    },
    {
      table: 'profiles',
      name: 'profiles_update_own',
      operation: 'UPDATE',
      role: 'authenticated',
      using: 'id = auth.uid()',
      description: 'Users can only update their own profile'
    },
    {
      table: 'profiles',
      name: 'profiles_insert_own',
      operation: 'INSERT',
      role: 'authenticated',
      check: 'id = auth.uid()',
      description: 'Users can only create their own profile'
    },

    // Opportunity policies (public read)
    {
      table: 'opportunities',
      name: 'opportunities_select_active',
      operation: 'SELECT',
      role: 'authenticated',
      using: 'active = true OR id IN (SELECT opportunity_id FROM saved_opportunities WHERE user_id = auth.uid())',
      description: 'Users can view active opportunities or their saved ones'
    },
    {
      table: 'opportunities',
      name: 'opportunities_insert_service',
      operation: 'INSERT',
      role: 'service_role',
      description: 'Only service role can insert opportunities (via sync)'
    },
    {
      table: 'opportunities',
      name: 'opportunities_update_service',
      operation: 'UPDATE',
      role: 'service_role',
      description: 'Only service role can update opportunities (via sync)'
    },

    // Saved opportunities policies
    {
      table: 'saved_opportunities',
      name: 'saved_opportunities_select_own',
      operation: 'SELECT',
      role: 'authenticated',
      using: 'user_id = auth.uid() OR company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can view their own saved opportunities or their company\'s'
    },
    {
      table: 'saved_opportunities',
      name: 'saved_opportunities_insert_own',
      operation: 'INSERT',
      role: 'authenticated',
      check: 'user_id = auth.uid() AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can only save opportunities for themselves'
    },
    {
      table: 'saved_opportunities',
      name: 'saved_opportunities_delete_own',
      operation: 'DELETE',
      role: 'authenticated',
      using: 'user_id = auth.uid()',
      description: 'Users can only delete their own saved opportunities'
    },

    // Proposal policies
    {
      table: 'proposals',
      name: 'proposals_select_company',
      operation: 'SELECT',
      role: 'authenticated',
      using: 'company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can view all proposals in their company'
    },
    {
      table: 'proposals',
      name: 'proposals_insert_company',
      operation: 'INSERT',
      role: 'authenticated',
      check: 'user_id = auth.uid() AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can create proposals for their company'
    },
    {
      table: 'proposals',
      name: 'proposals_update_company',
      operation: 'UPDATE',
      role: 'authenticated',
      using: 'company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can update proposals in their company'
    },
    {
      table: 'proposals',
      name: 'proposals_delete_own',
      operation: 'DELETE',
      role: 'authenticated',
      using: 'user_id = auth.uid() AND status = \'draft\'',
      description: 'Users can only delete their own draft proposals'
    },

    // Contract documents policies
    {
      table: 'contract_documents',
      name: 'contract_documents_select_company',
      operation: 'SELECT',
      role: 'authenticated',
      using: 'company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can view documents in their company'
    },
    {
      table: 'contract_documents',
      name: 'contract_documents_insert_company',
      operation: 'INSERT',
      role: 'authenticated',
      check: 'user_id = auth.uid() AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can upload documents for their company'
    },

    // Opportunity analyses policies
    {
      table: 'opportunity_analyses',
      name: 'opportunity_analyses_select_company',
      operation: 'SELECT',
      role: 'authenticated',
      using: 'company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can view analyses in their company'
    },
    {
      table: 'opportunity_analyses',
      name: 'opportunity_analyses_insert_company',
      operation: 'INSERT',
      role: 'authenticated',
      check: 'user_id = auth.uid() AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can create analyses for their company'
    },

    // Subscription policies
    {
      table: 'subscriptions',
      name: 'subscriptions_select_company',
      operation: 'SELECT',
      role: 'authenticated',
      using: 'company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can view their company subscription'
    },
    {
      table: 'subscriptions',
      name: 'subscriptions_update_service',
      operation: 'UPDATE',
      role: 'service_role',
      description: 'Only service role can update subscriptions (via Stripe)'
    },

    // API usage policies
    {
      table: 'api_usage',
      name: 'api_usage_select_company',
      operation: 'SELECT',
      role: 'authenticated',
      using: 'company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
      description: 'Users can view their company API usage'
    },
    {
      table: 'api_usage',
      name: 'api_usage_insert_service',
      operation: 'INSERT',
      role: 'service_role',
      description: 'Only service role can insert API usage'
    }
  ]

  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Get all policies for a specific table
   */
  static getPoliciesForTable(tableName: string): RLSPolicy[] {
    return this.policies.filter(p => p.table === tableName)
  }

  /**
   * Get all policies for a specific operation
   */
  static getPoliciesForOperation(operation: RLSPolicy['operation']): RLSPolicy[] {
    return this.policies.filter(p => p.operation === operation || p.operation === 'ALL')
  }

  /**
   * Validate a specific policy
   */
  static validatePolicy(policy: RLSPolicy): PolicyValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for required fields
    if (!policy.table || !policy.name || !policy.operation || !policy.role) {
      errors.push('Policy missing required fields')
    }

    // Check for using or check clause (service_role doesn't need these)
    if (policy.role !== 'service_role') {
      if (policy.operation !== 'INSERT' && !policy.using) {
        errors.push(`${policy.operation} policy should have a USING clause`)
      }
      if (policy.operation === 'INSERT' && !policy.check) {
        errors.push('INSERT policy should have a CHECK clause')
      }
    }

    // Check for auth.uid() usage
    if (policy.role === 'authenticated') {
      const hasAuthCheck = (policy.using || policy.check || '').includes('auth.uid()')
      if (!hasAuthCheck) {
        warnings.push('Authenticated policy does not reference auth.uid()')
      }
    }

    // Check for SQL injection risks
    const sqlPattern = /;|--|\/\*/
    if (sqlPattern.test(policy.using || '') || sqlPattern.test(policy.check || '')) {
      errors.push('Policy contains potentially dangerous SQL patterns')
    }

    return {
      isValid: errors.length === 0,
      policy,
      errors,
      warnings
    }
  }

  /**
   * Validate all policies
   */
  static validateAllPolicies(): {
    valid: RLSPolicy[]
    invalid: PolicyValidationResult[]
    warnings: PolicyValidationResult[]
  } {
    const valid: RLSPolicy[] = []
    const invalid: PolicyValidationResult[] = []
    const warnings: PolicyValidationResult[] = []

    for (const policy of this.policies) {
      const result = this.validatePolicy(policy)
      
      if (!result.isValid) {
        invalid.push(result)
      } else if (result.warnings.length > 0) {
        warnings.push(result)
        valid.push(policy)
      } else {
        valid.push(policy)
      }
    }

    return { valid, invalid, warnings }
  }

  /**
   * Test if a user has access to a specific operation
   */
  async testAccess(
    userId: string,
    table: string,
    operation: RLSPolicy['operation'],
    recordId?: string
  ): Promise<boolean> {
    const span = startSpan('RLSPolicyManager.testAccess')
    
    try {
      // Get relevant policies
      const policies = RLSPolicyManager.policies.filter(
        p => p.table === table && 
        (p.operation === operation || p.operation === 'ALL') &&
        p.role === 'authenticated'
      )

      if (policies.length === 0) {
        logger.warn('No RLS policies found for operation', { 
          table, 
          operation 
        })
        return false
      }

      // Test access by attempting a query
      let query = this.supabase.from(table).select('id')
      
      if (recordId) {
        query = query.eq('id', recordId)
      }
      
      query = query.limit(1)

      const { data, error } = await query

      if (error) {
        logger.debug('RLS access test failed', { 
          userId, 
          table, 
          operation, 
          error: error.message 
        })
        return false
      }

      span?.setStatus('ok')
      return true
    } catch (error) {
      span?.setStatus('error')
      logger.error('RLS access test error', error, { 
        userId, 
        table, 
        operation 
      })
      return false
    } finally {
      span?.finish()
    }
  }

  /**
   * Generate SQL for creating RLS policies
   */
  static generatePolicySQL(policy: RLSPolicy): string {
    const permissive = 'PERMISSIVE'
    const forClause = `FOR ${policy.operation}`
    const toClause = `TO ${policy.role}`
    
    let sql = `CREATE POLICY "${policy.name}"\n`
    sql += `  ON ${policy.table}\n`
    sql += `  AS ${permissive}\n`
    sql += `  ${forClause}\n`
    sql += `  ${toClause}\n`
    
    if (policy.using) {
      sql += `  USING (${policy.using})\n`
    }
    
    if (policy.check) {
      sql += `  WITH CHECK (${policy.check})\n`
    }
    
    sql += `;`
    
    return sql
  }

  /**
   * Generate documentation for all policies
   */
  static generateDocumentation(): string {
    let doc = '# Row Level Security (RLS) Policies\n\n'
    
    // Group policies by table
    const tables = [...new Set(this.policies.map(p => p.table))]
    
    for (const table of tables) {
      doc += `## ${table}\n\n`
      
      const tablePolicies = this.getPoliciesForTable(table)
      
      for (const policy of tablePolicies) {
        doc += `### ${policy.name}\n`
        doc += `- **Operation**: ${policy.operation}\n`
        doc += `- **Role**: ${policy.role}\n`
        doc += `- **Description**: ${policy.description}\n`
        
        if (policy.using) {
          doc += `- **Using**: \`${policy.using}\`\n`
        }
        
        if (policy.check) {
          doc += `- **Check**: \`${policy.check}\`\n`
        }
        
        doc += '\n'
      }
    }
    
    return doc
  }

  /**
   * Audit current RLS implementation
   */
  async auditPolicies(): Promise<{
    implemented: string[]
    missing: string[]
    extra: string[]
  }> {
    const span = startSpan('RLSPolicyManager.auditPolicies')
    
    try {
      // Get current policies from database
      const { data: currentPolicies, error } = await this.supabase
        .rpc('get_policies_for_schema', { schema_name: 'public' })

      if (error) {
        throw error
      }

      const implementedNames = new Set(
        (currentPolicies || []).map((p: any) => p.policyname)
      )
      
      const expectedNames = new Set(
        RLSPolicyManager.policies.map(p => p.name)
      )

      const implemented = [...implementedNames].filter(name => 
        expectedNames.has(name)
      )
      
      const missing = [...expectedNames].filter(name => 
        !implementedNames.has(name)
      )
      
      const extra = [...implementedNames].filter(name => 
        !expectedNames.has(name)
      )

      logger.info('RLS policy audit completed', {
        implemented: implemented.length,
        missing: missing.length,
        extra: extra.length
      })

      span?.setStatus('ok')
      return { implemented, missing, extra }
    } catch (error) {
      span?.setStatus('error')
      logger.error('RLS policy audit failed', error)
      throw error
    } finally {
      span?.finish()
    }
  }
}

// Export types
export type { PolicyValidationResult }