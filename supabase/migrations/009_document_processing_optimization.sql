-- Document Processing Optimization Migration
-- Supports OCR + AI processing with intelligent storage management
-- Designed to minimize costs while maximizing processing efficiency

-- Document metadata table (stores info about available documents, not the files themselves)
CREATE TABLE IF NOT EXISTS public.sam_opportunity_documents (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  notice_id text NOT NULL,
  document_id text NOT NULL,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size bigint,
  description text,
  last_modified timestamp with time zone,
  sam_download_url text NOT NULL,
  checksum text,
  is_required boolean DEFAULT false,
  category text NOT NULL CHECK (category IN ('solicitation', 'amendment', 'qa', 'attachment', 'other')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(notice_id, document_id)
);

-- Document downloads table (tracks when users actually download documents)
CREATE TABLE IF NOT EXISTS public.sam_document_downloads (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  notice_id text NOT NULL,
  document_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_path text, -- Supabase storage path (if stored)
  filename text NOT NULL,
  file_size bigint,
  download_url text, -- Signed URL for access
  api_call_used boolean DEFAULT true,
  downloaded_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at timestamp with time zone NOT NULL, -- When to delete from storage
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Document processing results (OCR + AI analysis results)
CREATE TABLE IF NOT EXISTS public.document_processing_results (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  notice_id text NOT NULL,
  document_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- OCR Results
  ocr_text text, -- Extracted text from document
  ocr_confidence numeric(4,3), -- 0.000 to 1.000
  ocr_page_count integer,
  ocr_provider text DEFAULT 'mistral',
  
  -- AI Analysis Results
  ai_analysis jsonb NOT NULL DEFAULT '{}'::jsonb, -- Structured AI analysis
  ai_relevance_score numeric(4,3), -- How relevant to opportunity
  ai_provider text DEFAULT 'claude',
  ai_tokens_used integer,
  
  -- Cost Tracking
  processing_cost jsonb NOT NULL DEFAULT '{}'::jsonb, -- Detailed cost breakdown
  estimated_opportunity_value numeric(15,2), -- For prioritization
  
  -- Storage Strategy
  storage_strategy jsonb DEFAULT '{}'::jsonb, -- How this result is stored/retained
  storage_size_bytes bigint, -- Total storage used
  
  -- Lifecycle Management
  confidence jsonb DEFAULT '{}'::jsonb, -- Overall confidence metrics
  priority text DEFAULT 'standard' CHECK (priority IN ('low', 'standard', 'high', 'critical')),
  expires_at timestamp with time zone NOT NULL,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(notice_id, document_id, user_id)
);

-- AI processing usage tracking (for billing and cost control)
CREATE TABLE IF NOT EXISTS public.ai_processing_usage (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  
  processing_type text NOT NULL, -- 'ocr', 'ai_analysis', 'cache_hit', 'batch_processing'
  provider text NOT NULL, -- 'mistral', 'claude', 'internal'
  
  -- Usage Metrics
  documents_processed integer DEFAULT 1,
  pages_processed integer DEFAULT 0,
  tokens_used integer DEFAULT 0,
  api_calls_made integer DEFAULT 0,
  
  -- Cost Breakdown
  cost_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_cost_usd numeric(10,4) DEFAULT 0,
  
  -- Context
  notice_id text, -- Associated opportunity
  processing_session_id uuid, -- For batch operations
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Processing queue for background OCR/AI tasks
CREATE TABLE IF NOT EXISTS public.document_processing_queue (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  notice_id text NOT NULL,
  document_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  priority text DEFAULT 'standard' CHECK (priority IN ('low', 'standard', 'high', 'critical')),
  processing_type text NOT NULL CHECK (processing_type IN ('ocr_only', 'ai_only', 'full_processing')),
  
  -- Queue Management
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  
  -- Scheduling
  scheduled_for timestamp with time zone DEFAULT timezone('utc'::text, now()),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  
  -- Configuration
  processing_options jsonb DEFAULT '{}'::jsonb,
  error_message text,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Cost optimization view - summarizes processing costs by user/company
CREATE OR REPLACE VIEW public.processing_cost_summary AS
SELECT 
  u.user_id,
  u.company_id,
  DATE_TRUNC('month', u.created_at) as month,
  COUNT(*) as total_operations,
  SUM(u.documents_processed) as total_documents,
  SUM(u.pages_processed) as total_pages,
  SUM(u.tokens_used) as total_tokens,
  SUM(u.total_cost_usd) as total_cost_usd,
  AVG(u.total_cost_usd) as avg_cost_per_operation,
  
  -- Breakdown by provider
  SUM(CASE WHEN u.provider = 'mistral' THEN u.total_cost_usd ELSE 0 END) as mistral_cost,
  SUM(CASE WHEN u.provider = 'claude' THEN u.total_cost_usd ELSE 0 END) as claude_cost,
  
  -- Efficiency metrics
  SUM(CASE WHEN u.processing_type = 'cache_hit' THEN 1 ELSE 0 END) as cache_hits,
  ROUND(
    (SUM(CASE WHEN u.processing_type = 'cache_hit' THEN 1 ELSE 0 END)::numeric / 
     GREATEST(COUNT(*), 1) * 100), 2
  ) as cache_hit_rate
FROM public.ai_processing_usage u
GROUP BY u.user_id, u.company_id, DATE_TRUNC('month', u.created_at);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sam_opportunity_documents_notice_id ON public.sam_opportunity_documents(notice_id);
CREATE INDEX IF NOT EXISTS idx_sam_opportunity_documents_category ON public.sam_opportunity_documents(category);
CREATE INDEX IF NOT EXISTS idx_sam_opportunity_documents_required ON public.sam_opportunity_documents(is_required);
CREATE INDEX IF NOT EXISTS idx_sam_opportunity_documents_size ON public.sam_opportunity_documents(file_size);

CREATE INDEX IF NOT EXISTS idx_sam_document_downloads_user ON public.sam_document_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_document_downloads_notice ON public.sam_document_downloads(notice_id);
CREATE INDEX IF NOT EXISTS idx_sam_document_downloads_expires ON public.sam_document_downloads(expires_at);
CREATE INDEX IF NOT EXISTS idx_sam_document_downloads_downloaded ON public.sam_document_downloads(downloaded_at);

CREATE INDEX IF NOT EXISTS idx_document_processing_results_user ON public.document_processing_results(user_id);
CREATE INDEX IF NOT EXISTS idx_document_processing_results_notice ON public.document_processing_results(notice_id);
CREATE INDEX IF NOT EXISTS idx_document_processing_results_expires ON public.document_processing_results(expires_at);
CREATE INDEX IF NOT EXISTS idx_document_processing_results_priority ON public.document_processing_results(priority);
CREATE INDEX IF NOT EXISTS idx_document_processing_results_value ON public.document_processing_results(estimated_opportunity_value);

CREATE INDEX IF NOT EXISTS idx_ai_processing_usage_user ON public.ai_processing_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_processing_usage_company ON public.ai_processing_usage(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_processing_usage_created ON public.ai_processing_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_processing_usage_type ON public.ai_processing_usage(processing_type);
CREATE INDEX IF NOT EXISTS idx_ai_processing_usage_cost ON public.ai_processing_usage(total_cost_usd);

CREATE INDEX IF NOT EXISTS idx_document_processing_queue_status ON public.document_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_document_processing_queue_priority ON public.document_processing_queue(priority);
CREATE INDEX IF NOT EXISTS idx_document_processing_queue_scheduled ON public.document_processing_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_document_processing_queue_user ON public.document_processing_queue(user_id);

-- RLS Policies

-- Document metadata policies
ALTER TABLE public.sam_opportunity_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view document metadata"
  ON public.sam_opportunity_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage document metadata"
  ON public.sam_opportunity_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Document downloads policies
ALTER TABLE public.sam_document_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own downloads"
  ON public.sam_document_downloads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own downloads"
  ON public.sam_document_downloads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage all downloads"
  ON public.sam_document_downloads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Processing results policies
ALTER TABLE public.document_processing_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processing results"
  ON public.document_processing_results FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own processing results"
  ON public.document_processing_results FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own processing results"
  ON public.document_processing_results FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage all processing results"
  ON public.document_processing_results FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AI usage tracking policies
ALTER TABLE public.ai_processing_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI usage"
  ON public.ai_processing_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Company members can view company AI usage"
  ON public.ai_processing_usage FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "System can insert AI usage records"
  ON public.ai_processing_usage FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Processing queue policies
ALTER TABLE public.document_processing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processing queue"
  ON public.document_processing_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own processing jobs"
  ON public.document_processing_queue FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage processing queue"
  ON public.document_processing_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Functions for cost management and optimization

-- Function to get user's processing cost summary
CREATE OR REPLACE FUNCTION public.get_user_processing_costs(
  p_user_id uuid,
  p_start_date timestamp with time zone DEFAULT (now() - interval '30 days'),
  p_end_date timestamp with time zone DEFAULT now()
)
RETURNS TABLE (
  total_cost_usd numeric,
  ocr_cost_usd numeric,
  ai_cost_usd numeric,
  storage_cost_usd numeric,
  documents_processed bigint,
  cache_hit_rate numeric,
  avg_cost_per_document numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(apu.total_cost_usd), 0) as total_cost_usd,
    COALESCE(SUM((apu.cost_breakdown->>'ocrCostUSD')::numeric), 0) as ocr_cost_usd,
    COALESCE(SUM((apu.cost_breakdown->>'aiCostUSD')::numeric), 0) as ai_cost_usd,
    COALESCE(SUM((apu.cost_breakdown->>'storageCostUSD')::numeric), 0) as storage_cost_usd,
    COALESCE(SUM(apu.documents_processed), 0) as documents_processed,
    ROUND(
      (COUNT(*) FILTER (WHERE apu.processing_type = 'cache_hit')::numeric / 
       GREATEST(COUNT(*), 1) * 100), 2
    ) as cache_hit_rate,
    CASE 
      WHEN SUM(apu.documents_processed) > 0 
      THEN ROUND(SUM(apu.total_cost_usd) / SUM(apu.documents_processed), 4)
      ELSE 0
    END as avg_cost_per_document
  FROM public.ai_processing_usage apu
  WHERE apu.user_id = p_user_id
    AND apu.created_at >= p_start_date
    AND apu.created_at <= p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired processing results
CREATE OR REPLACE FUNCTION public.cleanup_expired_processing_data()
RETURNS TABLE (
  downloads_deleted bigint,
  results_deleted bigint,
  storage_freed_gb numeric
) AS $$
DECLARE
  downloads_count bigint := 0;
  results_count bigint := 0;
  storage_freed bigint := 0;
BEGIN
  -- Clean up expired downloads
  WITH deleted_downloads AS (
    DELETE FROM public.sam_document_downloads 
    WHERE expires_at < now()
    RETURNING file_size
  )
  SELECT COUNT(*), COALESCE(SUM(file_size), 0)
  INTO downloads_count, storage_freed
  FROM deleted_downloads;
  
  -- Clean up expired processing results
  WITH deleted_results AS (
    DELETE FROM public.document_processing_results 
    WHERE expires_at < now()
    RETURNING storage_size_bytes
  )
  SELECT COUNT(*), COALESCE(SUM(storage_size_bytes), 0)
  INTO results_count, storage_freed
  FROM deleted_results;
  
  -- Return summary
  RETURN QUERY
  SELECT 
    downloads_count as downloads_deleted,
    results_count as results_deleted,
    ROUND((storage_freed::numeric / 1024 / 1024 / 1024), 3) as storage_freed_gb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get processing cost estimates
CREATE OR REPLACE FUNCTION public.estimate_processing_costs(
  p_notice_id text,
  p_document_ids text[] DEFAULT NULL
)
RETURNS TABLE (
  document_id text,
  filename text,
  estimated_cost_usd numeric,
  reasoning text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sod.document_id,
    sod.filename,
    CASE 
      WHEN sod.file_size IS NULL THEN 0.05
      ELSE ROUND(
        (CEIL(sod.file_size::numeric / (50 * 1024)) * 0.001) + -- OCR cost
        (CEIL(sod.file_size::numeric / (50 * 1024)) * 0.01) + -- AI cost estimate  
        ((sod.file_size::numeric / 1024 / 1024 / 1024) * 0.023), -- Storage cost
        4
      )
    END as estimated_cost_usd,
    CASE 
      WHEN sod.file_size IS NULL THEN 'Unknown file size - base estimate'
      ELSE CONCAT(
        'File size: ', ROUND(sod.file_size::numeric / 1024 / 1024, 2), 'MB, ',
        'Est. pages: ', CEIL(sod.file_size::numeric / (50 * 1024))
      )
    END as reasoning
  FROM public.sam_opportunity_documents sod
  WHERE sod.notice_id = p_notice_id
    AND (p_document_ids IS NULL OR sod.document_id = ANY(p_document_ids))
  ORDER BY 
    sod.is_required DESC,
    CASE sod.category 
      WHEN 'solicitation' THEN 1
      WHEN 'amendment' THEN 2
      WHEN 'qa' THEN 3
      WHEN 'attachment' THEN 4
      ELSE 5
    END,
    sod.file_size DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_processing_costs TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_processing_data TO authenticated;
GRANT EXECUTE ON FUNCTION public.estimate_processing_costs TO authenticated;

-- Create triggers for updated_at
CREATE TRIGGER handle_sam_opportunity_documents_updated_at BEFORE UPDATE ON public.sam_opportunity_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_document_processing_results_updated_at BEFORE UPDATE ON public.document_processing_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_document_processing_queue_updated_at BEFORE UPDATE ON public.document_processing_queue
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.sam_opportunity_documents IS 'Metadata for SAM.gov documents - no actual files stored';
COMMENT ON TABLE public.sam_document_downloads IS 'Tracks actual document downloads - files stored temporarily';
COMMENT ON TABLE public.document_processing_results IS 'OCR and AI processing results with cost tracking';
COMMENT ON TABLE public.ai_processing_usage IS 'Comprehensive AI/OCR usage tracking for billing';
COMMENT ON TABLE public.document_processing_queue IS 'Background processing queue for documents';

COMMENT ON FUNCTION public.get_user_processing_costs IS 'Get detailed processing cost breakdown for a user';
COMMENT ON FUNCTION public.cleanup_expired_processing_data IS 'Clean up expired data to free storage';
COMMENT ON FUNCTION public.estimate_processing_costs IS 'Estimate costs before processing documents';