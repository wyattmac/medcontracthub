-- Fix Opportunities RLS Policies
-- Enable public read access for active opportunities

-- First, ensure RLS is enabled on the opportunities table
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on opportunities table
DROP POLICY IF EXISTS "Public can view active opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can view all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can save opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Service role can manage opportunities" ON public.opportunities;

-- Create new RLS policies

-- 1. Public read access for active opportunities
CREATE POLICY "Public can view active opportunities"
    ON public.opportunities
    FOR SELECT
    TO public
    USING (status = 'active');

-- 2. Authenticated users can view all opportunities
CREATE POLICY "Authenticated users can view all opportunities"
    ON public.opportunities
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. Service role can do everything (for sync operations)
CREATE POLICY "Service role can manage opportunities"
    ON public.opportunities
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Anon users can also view active opportunities (for public API)
CREATE POLICY "Anonymous can view active opportunities"
    ON public.opportunities
    FOR SELECT
    TO anon
    USING (status = 'active');

-- Add index for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_opportunities_status 
    ON public.opportunities(status) 
    WHERE status = 'active';

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_opportunities_status_posted 
    ON public.opportunities(status, posted_date DESC);

-- Verify the policies are working
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'opportunities';
    
    RAISE NOTICE 'Created % RLS policies on opportunities table', policy_count;
END $$;