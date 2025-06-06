-- SAM.gov API Optimization Migration
-- Enhances database schema to capture ALL SAM.gov API data
-- Ensures maximum API efficiency for hundreds of users

-- Add comprehensive SAM.gov API usage tracking
CREATE TABLE IF NOT EXISTS public.sam_api_usage (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  operation text NOT NULL, -- 'search', 'detail', 'health', 'sync'
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint text NOT NULL, -- The actual API endpoint called
  query_params jsonb DEFAULT '{}'::jsonb, -- All query parameters used
  response_size integer, -- Size of response in bytes
  response_time_ms integer, -- API response time
  quota_remaining integer, -- Quota remaining after this call
  success boolean DEFAULT true,
  error_message text, -- If call failed
  cached boolean DEFAULT false, -- Was this served from cache
  metadata jsonb DEFAULT '{}'::jsonb, -- Additional context
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enhanced opportunities table with ALL SAM.gov fields
-- Add missing SAM.gov fields that weren't being captured
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS full_description text, -- Complete description from SAM.gov
ADD COLUMN IF NOT EXISTS classification_code text, -- Product/Service classification
ADD COLUMN IF NOT EXISTS popup_text text, -- SAM.gov popup information
ADD COLUMN IF NOT EXISTS vendor_info jsonb DEFAULT '{}'::jsonb, -- Vendor requirements
ADD COLUMN IF NOT EXISTS submission_info jsonb DEFAULT '{}'::jsonb, -- How to submit proposals
ADD COLUMN IF NOT EXISTS contact_info jsonb DEFAULT '{}'::jsonb, -- All contact information
ADD COLUMN IF NOT EXISTS award_info jsonb DEFAULT '{}'::jsonb, -- Award details and history
ADD COLUMN IF NOT EXISTS procurement_info jsonb DEFAULT '{}'::jsonb, -- Procurement specifics
ADD COLUMN IF NOT EXISTS sam_raw_data jsonb DEFAULT '{}'::jsonb, -- Complete raw SAM.gov response
ADD COLUMN IF NOT EXISTS last_updated_sam timestamp with time zone, -- When SAM.gov last updated
ADD COLUMN IF NOT EXISTS sync_version integer DEFAULT 1; -- Version tracking

-- SAM.gov search cache table - stores search results to minimize API calls
CREATE TABLE IF NOT EXISTS public.sam_search_cache (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  search_hash text UNIQUE NOT NULL, -- Hash of search parameters
  search_params jsonb NOT NULL, -- Original search parameters
  result_count integer NOT NULL, -- Number of results returned
  results jsonb NOT NULL, -- Complete search results from SAM.gov
  api_response_time_ms integer, -- How long SAM.gov took to respond
  expires_at timestamp with time zone NOT NULL, -- Cache expiration
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SAM.gov reference data cache - for agencies, NAICS codes, etc.
CREATE TABLE IF NOT EXISTS public.sam_reference_cache (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  reference_type text NOT NULL, -- 'agencies', 'naics', 'set_asides', etc.
  data jsonb NOT NULL, -- The reference data
  expires_at timestamp with time zone NOT NULL, -- Cache expiration (7 days)
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(reference_type)
);

-- SAM.gov detailed opportunity cache - full opportunity details
CREATE TABLE IF NOT EXISTS public.sam_opportunity_details (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  notice_id text UNIQUE NOT NULL, -- SAM.gov notice ID
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  full_details jsonb NOT NULL, -- Complete SAM.gov opportunity details
  documents jsonb DEFAULT '[]'::jsonb, -- All attached documents
  amendments jsonb DEFAULT '[]'::jsonb, -- Any amendments to the opportunity
  questions_answers jsonb DEFAULT '[]'::jsonb, -- Q&A section if available
  vendor_list jsonb DEFAULT '[]'::jsonb, -- List of interested vendors
  last_sam_update timestamp with time zone, -- When SAM.gov last modified
  expires_at timestamp with time zone NOT NULL, -- Cache expiration
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_sam_api_usage_operation ON public.sam_api_usage(operation);
CREATE INDEX IF NOT EXISTS idx_sam_api_usage_user ON public.sam_api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_api_usage_created ON public.sam_api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_sam_api_usage_success ON public.sam_api_usage(success);
CREATE INDEX IF NOT EXISTS idx_sam_api_usage_cached ON public.sam_api_usage(cached);

CREATE INDEX IF NOT EXISTS idx_sam_search_cache_hash ON public.sam_search_cache(search_hash);
CREATE INDEX IF NOT EXISTS idx_sam_search_cache_expires ON public.sam_search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_sam_search_cache_created ON public.sam_search_cache(created_at);

CREATE INDEX IF NOT EXISTS idx_sam_reference_cache_type ON public.sam_reference_cache(reference_type);
CREATE INDEX IF NOT EXISTS idx_sam_reference_cache_expires ON public.sam_reference_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_sam_opportunity_details_notice ON public.sam_opportunity_details(notice_id);
CREATE INDEX IF NOT EXISTS idx_sam_opportunity_details_expires ON public.sam_opportunity_details(expires_at);
CREATE INDEX IF NOT EXISTS idx_sam_opportunity_details_opportunity ON public.sam_opportunity_details(opportunity_id);

-- Enhance existing indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_opportunities_notice_id ON public.opportunities(notice_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_sam_raw ON public.opportunities USING gin(sam_raw_data);
CREATE INDEX IF NOT EXISTS idx_opportunities_sync_version ON public.opportunities(sync_version);
CREATE INDEX IF NOT EXISTS idx_opportunities_last_updated_sam ON public.opportunities(last_updated_sam);

-- RLS Policies for new tables

-- SAM API usage policies
ALTER TABLE public.sam_api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API usage"
  ON public.sam_api_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Admins can view all API usage"
  ON public.sam_api_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert API usage"
  ON public.sam_api_usage FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SAM search cache policies
ALTER TABLE public.sam_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read search cache"
  ON public.sam_search_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage search cache"
  ON public.sam_search_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- SAM reference cache policies
ALTER TABLE public.sam_reference_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reference cache"
  ON public.sam_reference_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage reference cache"
  ON public.sam_reference_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- SAM opportunity details policies
ALTER TABLE public.sam_opportunity_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read opportunity details"
  ON public.sam_opportunity_details FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage opportunity details"
  ON public.sam_opportunity_details FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Functions for cache management

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  -- Clean up expired search cache
  DELETE FROM public.sam_search_cache 
  WHERE expires_at < now();
  
  -- Clean up expired reference cache
  DELETE FROM public.sam_reference_cache 
  WHERE expires_at < now();
  
  -- Clean up expired opportunity details
  DELETE FROM public.sam_opportunity_details 
  WHERE expires_at < now();
  
  -- Log cleanup
  INSERT INTO public.sam_api_usage (
    operation,
    endpoint,
    metadata,
    created_at
  ) VALUES (
    'cleanup',
    'cache_cleanup',
    jsonb_build_object('action', 'expired_cache_cleanup'),
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get cache hit rate
CREATE OR REPLACE FUNCTION public.get_cache_hit_rate(
  p_start_date timestamp with time zone DEFAULT (now() - interval '24 hours'),
  p_end_date timestamp with time zone DEFAULT now()
)
RETURNS TABLE (
  total_requests bigint,
  cached_requests bigint,
  cache_hit_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE cached = true) as cached_requests,
    ROUND(
      (COUNT(*) FILTER (WHERE cached = true)::numeric / 
       GREATEST(COUNT(*), 1) * 100), 2
    ) as cache_hit_rate
  FROM public.sam_api_usage
  WHERE created_at >= p_start_date 
    AND created_at <= p_end_date
    AND operation IN ('search', 'detail');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get API usage analytics
CREATE OR REPLACE FUNCTION public.get_api_usage_analytics(
  p_start_date timestamp with time zone DEFAULT (now() - interval '24 hours'),
  p_end_date timestamp with time zone DEFAULT now()
)
RETURNS TABLE (
  operation text,
  total_calls bigint,
  successful_calls bigint,
  failed_calls bigint,
  cached_calls bigint,
  avg_response_time numeric,
  total_data_mb numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sau.operation,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE sau.success = true) as successful_calls,
    COUNT(*) FILTER (WHERE sau.success = false) as failed_calls,
    COUNT(*) FILTER (WHERE sau.cached = true) as cached_calls,
    ROUND(AVG(sau.response_time_ms), 2) as avg_response_time,
    ROUND(SUM(sau.response_size::numeric) / 1024 / 1024, 2) as total_data_mb
  FROM public.sam_api_usage sau
  WHERE sau.created_at >= p_start_date 
    AND sau.created_at <= p_end_date
  GROUP BY sau.operation
  ORDER BY total_calls DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.cleanup_expired_cache TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cache_hit_rate TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_api_usage_analytics TO authenticated;

-- Create triggers for updated_at
CREATE TRIGGER handle_sam_api_usage_updated_at BEFORE UPDATE ON public.sam_api_usage
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_sam_search_cache_updated_at BEFORE UPDATE ON public.sam_search_cache
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_sam_reference_cache_updated_at BEFORE UPDATE ON public.sam_reference_cache
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_sam_opportunity_details_updated_at BEFORE UPDATE ON public.sam_opportunity_details
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add comment for migration tracking
COMMENT ON TABLE public.sam_api_usage IS 'Tracks all SAM.gov API calls for usage optimization';
COMMENT ON TABLE public.sam_search_cache IS 'Caches SAM.gov search results to minimize API calls';
COMMENT ON TABLE public.sam_reference_cache IS 'Caches SAM.gov reference data (agencies, NAICS, etc.)';
COMMENT ON TABLE public.sam_opportunity_details IS 'Stores complete SAM.gov opportunity details with caching';