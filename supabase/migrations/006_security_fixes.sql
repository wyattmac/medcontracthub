-- Security Fixes Migration
-- Addresses security issues identified by Supabase database linter

-- Fix function search_path vulnerabilities
-- Setting search_path prevents malicious users from creating objects with the same name
-- in their schema that could be called instead of the intended function

-- First, let's check if these functions exist and update them
DO $$
BEGIN
    -- Fix handle_new_user function if it exists
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
    ) THEN
        ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_catalog;
    END IF;

    -- Fix handle_updated_at function if it exists
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'handle_updated_at'
    ) THEN
        ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_catalog;
    END IF;
END $$;

-- Create or replace the handle_updated_at function with secure search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

-- Create or replace the handle_new_user function with secure search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$;

-- Add comments explaining the security measures
COMMENT ON FUNCTION public.handle_updated_at() IS 'Automatically updates the updated_at timestamp. Uses fixed search_path for security.';
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates a profile entry when a new user signs up. Uses fixed search_path for security.';

-- Additional security recommendations for production:
-- 1. Enable leaked password protection in Supabase Auth dashboard
-- 2. Enable additional MFA options (TOTP, SMS) in Supabase Auth dashboard
-- 3. Regularly review and update RLS policies
-- 4. Monitor audit logs for suspicious activity

-- Create indexes on foreign key columns if they don't exist
-- This improves performance and prevents lock escalation issues
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user_opportunity ON public.saved_opportunities(user_id, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_proposal_sections_proposal_id ON public.proposal_sections(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_attachments_proposal_id ON public.proposal_attachments(proposal_id);

-- Add check constraints for data integrity
ALTER TABLE public.opportunities 
ADD CONSTRAINT chk_opportunities_dates 
CHECK (posted_date <= response_deadline);

ALTER TABLE public.opportunities 
ADD CONSTRAINT chk_opportunities_value 
CHECK (
    (estimated_value_min IS NULL AND estimated_value_max IS NULL) OR
    (estimated_value_min IS NOT NULL AND estimated_value_max IS NOT NULL AND estimated_value_min <= estimated_value_max)
);

ALTER TABLE public.proposals 
ADD CONSTRAINT chk_proposals_win_probability 
CHECK (win_probability IS NULL OR (win_probability >= 0 AND win_probability <= 1));

ALTER TABLE public.opportunity_analyses 
ADD CONSTRAINT chk_opportunity_analyses_score 
CHECK (score IS NULL OR (score >= 0 AND score <= 1));

-- Ensure all timestamp columns have proper timezone handling
-- This is already done in the schema, but let's document it
COMMENT ON COLUMN public.opportunities.posted_date IS 'Timestamp with timezone - always stored in UTC';
COMMENT ON COLUMN public.opportunities.response_deadline IS 'Timestamp with timezone - critical for deadline calculations';
COMMENT ON COLUMN public.saved_opportunities.reminder_date IS 'Timestamp with timezone - used for email reminders';

-- Grant appropriate permissions (adjust based on your RLS policies)
-- These are examples - your actual permissions should be defined by RLS policies
COMMENT ON SCHEMA public IS 'Main application schema - access controlled via RLS policies';