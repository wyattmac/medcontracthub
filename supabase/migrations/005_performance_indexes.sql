-- Performance Indexes Migration
-- This migration adds indexes to improve query performance on frequently accessed columns

-- Opportunities table indexes
-- Index for filtering by NAICS code (common in opportunity searches)
CREATE INDEX IF NOT EXISTS idx_opportunities_naics_code 
ON public.opportunities(naics_code) 
WHERE naics_code IS NOT NULL;

-- Index for filtering by set-aside type (SDVOSB, WOSB, etc.)
CREATE INDEX IF NOT EXISTS idx_opportunities_set_aside_type 
ON public.opportunities(set_aside_type) 
WHERE set_aside_type IS NOT NULL;

-- Index for filtering by response deadline (critical for deadline searches)
CREATE INDEX IF NOT EXISTS idx_opportunities_response_deadline 
ON public.opportunities(response_deadline);

-- Index for filtering by status (active, awarded, cancelled, expired)
CREATE INDEX IF NOT EXISTS idx_opportunities_status 
ON public.opportunities(status);

-- Index for filtering by state/location
CREATE INDEX IF NOT EXISTS idx_opportunities_place_of_performance_state 
ON public.opportunities(place_of_performance_state) 
WHERE place_of_performance_state IS NOT NULL;

-- Composite index for common query pattern: active opportunities by deadline
CREATE INDEX IF NOT EXISTS idx_opportunities_active_deadline 
ON public.opportunities(status, response_deadline) 
WHERE status = 'active';

-- Index for agency searches
CREATE INDEX IF NOT EXISTS idx_opportunities_agency 
ON public.opportunities(agency);

-- Index for posted date (for sorting and filtering recent opportunities)
CREATE INDEX IF NOT EXISTS idx_opportunities_posted_date 
ON public.opportunities(posted_date DESC);

-- Saved opportunities table indexes
-- Index for user's saved opportunities (most common query)
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user_id 
ON public.saved_opportunities(user_id);

-- Index for finding all users who saved a specific opportunity
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_opportunity_id 
ON public.saved_opportunities(opportunity_id);

-- Composite index for user's opportunities with reminders
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user_reminder 
ON public.saved_opportunities(user_id, reminder_date) 
WHERE reminder_date IS NOT NULL;

-- Opportunity analyses table indexes
-- Index for finding analyses by opportunity
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_opportunity_id 
ON public.opportunity_analyses(opportunity_id);

-- Index for finding analyses by company
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_company_id 
ON public.opportunity_analyses(company_id);

-- Composite index for unique constraint enforcement
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_unique 
ON public.opportunity_analyses(opportunity_id, company_id, analysis_type);

-- Proposals table indexes
-- Index for company's proposals
CREATE INDEX IF NOT EXISTS idx_proposals_company_id 
ON public.proposals(company_id);

-- Index for proposals by opportunity
CREATE INDEX IF NOT EXISTS idx_proposals_opportunity_id 
ON public.proposals(opportunity_id);

-- Index for proposals by status
CREATE INDEX IF NOT EXISTS idx_proposals_status 
ON public.proposals(status);

-- Index for submission deadline
CREATE INDEX IF NOT EXISTS idx_proposals_submission_deadline 
ON public.proposals(submission_deadline) 
WHERE submission_deadline IS NOT NULL;

-- Audit logs table indexes
-- Index for user activity lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
ON public.audit_logs(user_id);

-- Index for company activity lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id 
ON public.audit_logs(company_id);

-- Index for recent activity (most queries look at recent logs)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON public.audit_logs(created_at DESC);

-- Email subscriptions indexes
-- Index for finding user's subscriptions
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_user_id 
ON public.email_subscriptions(user_id);

-- Index for finding active subscriptions by type
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_type_active 
ON public.email_subscriptions(subscription_type, is_active) 
WHERE is_active = true;

-- Companies table indexes
-- Index for DUNS number lookups
CREATE INDEX IF NOT EXISTS idx_companies_duns_number 
ON public.companies(duns_number) 
WHERE duns_number IS NOT NULL;

-- Index for CAGE code lookups
CREATE INDEX IF NOT EXISTS idx_companies_cage_code 
ON public.companies(cage_code) 
WHERE cage_code IS NOT NULL;

-- Index for subscription management
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status 
ON public.companies(subscription_status, subscription_plan);

-- Profiles table indexes
-- Index for company members lookup
CREATE INDEX IF NOT EXISTS idx_profiles_company_id 
ON public.profiles(company_id) 
WHERE company_id IS NOT NULL;

-- Index for active users
CREATE INDEX IF NOT EXISTS idx_profiles_is_active 
ON public.profiles(is_active) 
WHERE is_active = true;

-- Add comments to explain index usage
COMMENT ON INDEX idx_opportunities_naics_code IS 'Speeds up filtering opportunities by NAICS code';
COMMENT ON INDEX idx_opportunities_set_aside_type IS 'Speeds up filtering opportunities by set-aside type (SDVOSB, WOSB, etc.)';
COMMENT ON INDEX idx_opportunities_response_deadline IS 'Critical for deadline-based queries and sorting';
COMMENT ON INDEX idx_saved_opportunities_user_id IS 'Primary access pattern for user saved opportunities';
COMMENT ON INDEX idx_opportunities_active_deadline IS 'Optimizes common query for active opportunities sorted by deadline';

-- Fix security issues from Supabase linter
-- Set search_path for functions to prevent role-based vulnerabilities
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;

-- Add index on updated_at columns for sync operations
CREATE INDEX IF NOT EXISTS idx_opportunities_updated_at 
ON public.opportunities(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_opportunities_updated_at 
ON public.saved_opportunities(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposals_updated_at 
ON public.proposals(updated_at DESC);

-- Performance tip: Analyze tables after creating indexes
ANALYZE public.opportunities;
ANALYZE public.saved_opportunities;
ANALYZE public.opportunity_analyses;
ANALYZE public.proposals;
ANALYZE public.audit_logs;
ANALYZE public.email_subscriptions;
ANALYZE public.companies;
ANALYZE public.profiles;