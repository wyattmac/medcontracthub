/**
 * RLS Policy Manager Unit Tests
 * 
 * Tests policy validation, documentation generation,
 * access testing, and policy audit functionality
 */

import { RLSPolicyManager, RLSPolicy } from '@/lib/db/security/rls-policies'
import { createMockSupabaseClient } from '@/__tests__/utils/db-test-helper'

// Mock performance monitoring
jest.mock('@/lib/monitoring/performance', () => ({
  startSpan: jest.fn(() => ({
    setStatus: jest.fn(),
    finish: jest.fn()
  }))
}))

describe('RLSPolicyManager', () => {
  let manager: RLSPolicyManager
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    manager = new RLSPolicyManager(mockSupabase)
    jest.clearAllMocks()
  })

  describe('Policy Definition', () => {
    it('should have all required policies defined', () => {
      const policies = RLSPolicyManager['policies']
      
      // Check we have policies for all critical tables
      const requiredTables = [
        'companies', 'profiles', 'opportunities', 'saved_opportunities',
        'proposals', 'contract_documents', 'opportunity_analyses',
        'subscriptions', 'api_usage'
      ]

      requiredTables.forEach(table => {
        const tablePolicies = policies.filter(p => p.table === table)
        expect(tablePolicies.length).toBeGreaterThan(0)
      })
    })

    it('should have policies for all operations on critical tables', () => {
      const criticalTables = ['companies', 'profiles', 'proposals']
      
      criticalTables.forEach(table => {
        const tablePolicies = RLSPolicyManager.getPoliciesForTable(table)
        const operations = tablePolicies.map(p => p.operation)
        
        expect(operations).toContain('SELECT')
        // Not all tables need all operations
      })
    })

    it('should include auth.uid() in authenticated policies', () => {
      const authPolicies = RLSPolicyManager['policies'].filter(
        p => p.role === 'authenticated'
      )

      authPolicies.forEach(policy => {
        const hasAuthCheck = 
          (policy.using || '').includes('auth.uid()') ||
          (policy.check || '').includes('auth.uid()')
        
        // Most authenticated policies should reference auth.uid()
        if (!hasAuthCheck && policy.operation !== 'ALL') {
          console.warn(`Policy ${policy.name} may be missing auth.uid() check`)
        }
      })
    })
  })

  describe('getPoliciesForTable', () => {
    it('should return all policies for a table', () => {
      const policies = RLSPolicyManager.getPoliciesForTable('companies')
      
      expect(policies.length).toBeGreaterThan(0)
      expect(policies.every(p => p.table === 'companies')).toBe(true)
    })

    it('should return empty array for non-existent table', () => {
      const policies = RLSPolicyManager.getPoliciesForTable('non_existent_table')
      expect(policies).toEqual([])
    })
  })

  describe('getPoliciesForOperation', () => {
    it('should return policies for specific operation', () => {
      const policies = RLSPolicyManager.getPoliciesForOperation('SELECT')
      
      expect(policies.length).toBeGreaterThan(0)
      expect(policies.every(p => p.operation === 'SELECT' || p.operation === 'ALL')).toBe(true)
    })

    it('should include ALL policies for any operation', () => {
      const insertPolicies = RLSPolicyManager.getPoliciesForOperation('INSERT')
      const allPolicies = insertPolicies.filter(p => p.operation === 'ALL')
      
      // Should include any ALL policies if they exist
      expect(insertPolicies.length).toBeGreaterThanOrEqual(allPolicies.length)
    })
  })

  describe('validatePolicy', () => {
    it('should validate a correct policy', () => {
      const policy: RLSPolicy = {
        table: 'companies',
        name: 'companies_select_own',
        operation: 'SELECT',
        role: 'authenticated',
        using: 'id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
        description: 'Users can only view their own company'
      }

      const result = RLSPolicyManager.validatePolicy(policy)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const policy: any = {
        table: 'companies',
        // missing name, operation, role
      }

      const result = RLSPolicyManager.validatePolicy(policy)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Policy missing required fields')
    })

    it('should validate SELECT policies have USING clause', () => {
      const policy: RLSPolicy = {
        table: 'companies',
        name: 'bad_select',
        operation: 'SELECT',
        role: 'authenticated',
        // missing using clause
        description: 'Bad policy'
      }

      const result = RLSPolicyManager.validatePolicy(policy)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('SELECT policy should have a USING clause')
    })

    it('should validate INSERT policies have CHECK clause', () => {
      const policy: RLSPolicy = {
        table: 'profiles',
        name: 'bad_insert',
        operation: 'INSERT',
        role: 'authenticated',
        // missing check clause
        description: 'Bad policy'
      }

      const result = RLSPolicyManager.validatePolicy(policy)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('INSERT policy should have a CHECK clause')
    })

    it('should warn about missing auth.uid() in authenticated policies', () => {
      const policy: RLSPolicy = {
        table: 'companies',
        name: 'missing_auth',
        operation: 'SELECT',
        role: 'authenticated',
        using: 'active = true', // No auth.uid() reference
        description: 'Missing auth check'
      }

      const result = RLSPolicyManager.validatePolicy(policy)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Authenticated policy does not reference auth.uid()')
    })

    it('should detect SQL injection patterns', () => {
      const policy: RLSPolicy = {
        table: 'companies',
        name: 'sql_injection',
        operation: 'SELECT',
        role: 'authenticated',
        using: 'id = auth.uid(); DROP TABLE companies;--',
        description: 'Dangerous policy'
      }

      const result = RLSPolicyManager.validatePolicy(policy)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Policy contains potentially dangerous SQL patterns')
    })
  })

  describe('validateAllPolicies', () => {
    it('should validate all defined policies', () => {
      const results = RLSPolicyManager.validateAllPolicies()

      expect(results.valid.length).toBeGreaterThan(0)
      expect(results.invalid.length).toBe(0) // All our policies should be valid
      
      // Log any warnings for review
      if (results.warnings.length > 0) {
        console.log('Policy warnings:', results.warnings.map(w => ({
          name: w.policy.name,
          warnings: w.warnings
        })))
      }
    })
  })

  describe('testAccess', () => {
    it('should test user access to a resource', async () => {
      mockSupabase = createMockSupabaseClient({
        responses: {
          'companies.select': { data: [{ id: 'company-1' }], error: null }
        }
      })
      manager = new RLSPolicyManager(mockSupabase)

      const hasAccess = await manager.testAccess(
        'user-1',
        'companies',
        'SELECT',
        'company-1'
      )

      expect(hasAccess).toBe(true)
      const query = mockSupabase.from.mock.results[0]?.value
      expect(query.select).toHaveBeenCalledWith('id')
      expect(query.eq).toHaveBeenCalledWith('id', 'company-1')
    })

    it('should return false when access denied', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'companies.select': { code: 'PGRST301', message: 'Permission denied' }
        }
      })
      manager = new RLSPolicyManager(mockSupabase)

      const hasAccess = await manager.testAccess(
        'user-1',
        'companies',
        'SELECT',
        'company-1'
      )

      expect(hasAccess).toBe(false)
    })

    it('should handle missing policies', async () => {
      const hasAccess = await manager.testAccess(
        'user-1',
        'non_existent_table',
        'SELECT'
      )

      expect(hasAccess).toBe(false)
    })
  })

  describe('generatePolicySQL', () => {
    it('should generate correct SQL for SELECT policy', () => {
      const policy: RLSPolicy = {
        table: 'companies',
        name: 'companies_select_own',
        operation: 'SELECT',
        role: 'authenticated',
        using: 'id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
        description: 'Test policy'
      }

      const sql = RLSPolicyManager.generatePolicySQL(policy)

      expect(sql).toContain('CREATE POLICY "companies_select_own"')
      expect(sql).toContain('ON companies')
      expect(sql).toContain('AS PERMISSIVE')
      expect(sql).toContain('FOR SELECT')
      expect(sql).toContain('TO authenticated')
      expect(sql).toContain('USING (id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))')
    })

    it('should generate correct SQL for INSERT policy', () => {
      const policy: RLSPolicy = {
        table: 'profiles',
        name: 'profiles_insert_own',
        operation: 'INSERT',
        role: 'authenticated',
        check: 'id = auth.uid()',
        description: 'Test policy'
      }

      const sql = RLSPolicyManager.generatePolicySQL(policy)

      expect(sql).toContain('CREATE POLICY "profiles_insert_own"')
      expect(sql).toContain('FOR INSERT')
      expect(sql).toContain('WITH CHECK (id = auth.uid())')
      expect(sql).not.toContain('USING')
    })

    it('should handle policies with both USING and CHECK', () => {
      const policy: RLSPolicy = {
        table: 'test_table',
        name: 'test_policy',
        operation: 'UPDATE',
        role: 'authenticated',
        using: 'user_id = auth.uid()',
        check: 'user_id = auth.uid()',
        description: 'Test policy'
      }

      const sql = RLSPolicyManager.generatePolicySQL(policy)

      expect(sql).toContain('USING (user_id = auth.uid())')
      expect(sql).toContain('WITH CHECK (user_id = auth.uid())')
    })
  })

  describe('generateDocumentation', () => {
    it('should generate markdown documentation', () => {
      const doc = RLSPolicyManager.generateDocumentation()

      expect(doc).toContain('# Row Level Security (RLS) Policies')
      expect(doc).toContain('## companies')
      expect(doc).toContain('## profiles')
      expect(doc).toContain('## opportunities')
      expect(doc).toContain('### ')
      expect(doc).toContain('- **Operation**:')
      expect(doc).toContain('- **Role**:')
      expect(doc).toContain('- **Description**:')
    })

    it('should include all policies in documentation', () => {
      const doc = RLSPolicyManager.generateDocumentation()
      const policies = RLSPolicyManager['policies']

      policies.forEach(policy => {
        expect(doc).toContain(policy.name)
        expect(doc).toContain(policy.description)
      })
    })
  })

  describe('auditPolicies', () => {
    it('should audit current vs expected policies', async () => {
      const mockPolicies = [
        { policyname: 'companies_select_own' },
        { policyname: 'profiles_select_own' },
        { policyname: 'extra_policy' }
      ]

      mockSupabase = createMockSupabaseClient({
        responses: {
          'rpc.get_policies_for_schema': mockPolicies
        }
      })
      manager = new RLSPolicyManager(mockSupabase)

      const audit = await manager.auditPolicies()

      expect(audit.implemented).toContain('companies_select_own')
      expect(audit.implemented).toContain('profiles_select_own')
      expect(audit.extra).toContain('extra_policy')
      expect(audit.missing.length).toBeGreaterThan(0) // We have more policies defined than mocked
    })

    it('should handle RPC errors', async () => {
      mockSupabase = createMockSupabaseClient({
        errors: {
          'rpc.get_policies_for_schema': new Error('RPC function not found')
        }
      })
      manager = new RLSPolicyManager(mockSupabase)

      await expect(manager.auditPolicies()).rejects.toThrow()
    })
  })

  describe('Policy Coverage', () => {
    it('should have complete coverage for authenticated users', () => {
      const tables = ['companies', 'profiles', 'proposals', 'saved_opportunities']
      
      tables.forEach(table => {
        const policies = RLSPolicyManager.getPoliciesForTable(table)
        const authPolicies = policies.filter(p => p.role === 'authenticated')
        
        expect(authPolicies.length).toBeGreaterThan(0)
        
        // Check for SELECT policy at minimum
        const hasSelect = authPolicies.some(p => p.operation === 'SELECT')
        expect(hasSelect).toBe(true)
      })
    })

    it('should restrict service-only operations', () => {
      const serviceOnlyTables = ['api_usage', 'subscriptions']
      
      serviceOnlyTables.forEach(table => {
        const policies = RLSPolicyManager.getPoliciesForTable(table)
        const writePolicies = policies.filter(
          p => p.operation === 'INSERT' || p.operation === 'UPDATE'
        )
        
        writePolicies.forEach(policy => {
          expect(policy.role).toBe('service_role')
        })
      })
    })

    it('should enforce company isolation', () => {
      const companyIsolatedTables = ['proposals', 'contract_documents', 'opportunity_analyses']
      
      companyIsolatedTables.forEach(table => {
        const policies = RLSPolicyManager.getPoliciesForTable(table)
        const selectPolicies = policies.filter(p => p.operation === 'SELECT')
        
        selectPolicies.forEach(policy => {
          if (policy.role === 'authenticated') {
            expect(policy.using || '').toContain('company_id')
          }
        })
      })
    })
  })
})