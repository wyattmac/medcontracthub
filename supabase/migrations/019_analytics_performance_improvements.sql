-- Migration: Analytics and Performance Improvements
-- Description: Add indexes and functions to improve opportunities page performance

-- Create function for getting opportunities timeline (if missing)
CREATE OR REPLACE FUNCTION get_opportunities_timeline(
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  new_count BIGINT,
  expiring_count BIGINT,
  total_active BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '1 day' * days_back,
      CURRENT_DATE,
      INTERVAL '1 day'
    )::DATE AS date
  )
  SELECT 
    ds.date,
    COALESCE(COUNT(DISTINCT o1.id) FILTER (WHERE o1.posted_date::DATE = ds.date), 0) AS new_count,
    COALESCE(COUNT(DISTINCT o2.id) FILTER (WHERE o2.response_deadline::DATE = ds.date), 0) AS expiring_count,
    COALESCE(COUNT(DISTINCT o3.id) FILTER (WHERE o3.status = 'active'), 0) AS total_active
  FROM date_series ds
  LEFT JOIN opportunities o1 ON o1.posted_date::DATE = ds.date
  LEFT JOIN opportunities o2 ON o2.response_deadline::DATE = ds.date
  LEFT JOIN opportunities o3 ON o3.status = 'active' AND o3.posted_date::DATE <= ds.date
  GROUP BY ds.date
  ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for common query patterns
-- Index for status + posted_date (common filter + sort)
CREATE INDEX IF NOT EXISTS idx_opportunities_status_posted 
ON opportunities(status, posted_date DESC) 
WHERE status = 'active';

-- Index for response_deadline queries
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline 
ON opportunities(response_deadline) 
WHERE status = 'active' AND response_deadline IS NOT NULL;

-- Index for NAICS code searches
CREATE INDEX IF NOT EXISTS idx_opportunities_naics 
ON opportunities(naics_code) 
WHERE status = 'active';

-- Index for agency searches
CREATE INDEX IF NOT EXISTS idx_opportunities_agency_text 
ON opportunities USING gin(to_tsvector('english', agency)) 
WHERE status = 'active';

-- Index for title/description text searches
CREATE INDEX IF NOT EXISTS idx_opportunities_search_text 
ON opportunities USING gin(
  to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''))
) WHERE status = 'active';

-- Index for value range queries
CREATE INDEX IF NOT EXISTS idx_opportunities_value_range 
ON opportunities(estimated_value_min, estimated_value_max) 
WHERE status = 'active';

-- Composite index for saved opportunities joins
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_composite 
ON saved_opportunities(opportunity_id, user_id);

-- Add performance tracking table for monitoring
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_time_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Index for performance metrics analysis
CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint 
ON performance_metrics(endpoint, timestamp DESC);

-- Grant permissions
GRANT SELECT ON get_opportunities_timeline TO authenticated, anon;
GRANT INSERT ON performance_metrics TO authenticated, anon;

-- Add comment
COMMENT ON FUNCTION get_opportunities_timeline IS 'Returns daily statistics for opportunities over the specified number of days';
COMMENT ON TABLE performance_metrics IS 'Tracks API endpoint performance for monitoring and optimization';