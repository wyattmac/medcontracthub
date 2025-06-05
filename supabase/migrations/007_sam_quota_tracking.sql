-- Migration: SAM.gov API Quota Tracking
-- Enables intelligent quota management and usage optimization

-- SAM.gov API usage tracking table
CREATE TABLE IF NOT EXISTS sam_api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation TEXT NOT NULL CHECK (operation IN ('search', 'detail', 'health', 'sync')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sam_api_usage_created_at ON sam_api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_sam_api_usage_operation ON sam_api_usage(operation);
CREATE INDEX IF NOT EXISTS idx_sam_api_usage_user_id ON sam_api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_api_usage_daily ON sam_api_usage(date_trunc('day', created_at));
CREATE INDEX IF NOT EXISTS idx_sam_api_usage_hourly ON sam_api_usage(date_trunc('hour', created_at));

-- Row Level Security
ALTER TABLE sam_api_usage ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own API usage" ON sam_api_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert API usage records" ON sam_api_usage
  FOR INSERT WITH CHECK (true);

-- Admins can view all usage (for monitoring)
CREATE POLICY "Admins can view all API usage" ON sam_api_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Function to get daily quota usage
CREATE OR REPLACE FUNCTION get_daily_sam_quota_usage(target_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(COUNT(*), 0)::INTEGER
  FROM sam_api_usage
  WHERE date_trunc('day', created_at) = target_date;
$$;

-- Function to get hourly quota usage
CREATE OR REPLACE FUNCTION get_hourly_sam_quota_usage(target_hour TIMESTAMP WITH TIME ZONE DEFAULT date_trunc('hour', NOW()))
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(COUNT(*), 0)::INTEGER
  FROM sam_api_usage
  WHERE date_trunc('hour', created_at) = target_hour;
$$;

-- Function to get quota analytics
CREATE OR REPLACE FUNCTION get_sam_quota_analytics(
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE SQL
STABLE
AS $$
  SELECT json_build_object(
    'total_calls', COUNT(*),
    'by_operation', (
      SELECT json_object_agg(operation, count)
      FROM (
        SELECT operation, COUNT(*) as count
        FROM sam_api_usage
        WHERE created_at::date BETWEEN start_date AND end_date
        GROUP BY operation
      ) ops
    ),
    'by_hour', (
      SELECT json_object_agg(hour, count)
      FROM (
        SELECT EXTRACT(hour FROM created_at)::INTEGER as hour, COUNT(*) as count
        FROM sam_api_usage
        WHERE created_at::date BETWEEN start_date AND end_date
        GROUP BY EXTRACT(hour FROM created_at)
      ) hours
    ),
    'top_users', (
      SELECT json_agg(json_build_object('user_id', user_id, 'count', count))
      FROM (
        SELECT user_id, COUNT(*) as count
        FROM sam_api_usage
        WHERE created_at::date BETWEEN start_date AND end_date
        AND user_id IS NOT NULL
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 10
      ) users
    )
  )
  FROM sam_api_usage
  WHERE created_at::date BETWEEN start_date AND end_date;
$$;

-- Function to clean up old usage records (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_sam_api_usage()
RETURNS INTEGER
LANGUAGE SQL
AS $$
  WITH deleted AS (
    DELETE FROM sam_api_usage
    WHERE created_at < NOW() - INTERVAL '90 days'
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER FROM deleted;
$$;

-- Trigger to automatically clean up old records daily
CREATE OR REPLACE FUNCTION trigger_cleanup_sam_api_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only run cleanup once per day (when first record is inserted each day)
  IF NOT EXISTS (
    SELECT 1 FROM sam_api_usage 
    WHERE created_at::date = CURRENT_DATE 
    AND created_at < NEW.created_at
  ) THEN
    PERFORM cleanup_sam_api_usage();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for automatic cleanup
DROP TRIGGER IF EXISTS auto_cleanup_sam_api_usage ON sam_api_usage;
CREATE TRIGGER auto_cleanup_sam_api_usage
  AFTER INSERT ON sam_api_usage
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_sam_api_usage();

-- Add quota tracking to existing usage_records table
ALTER TABLE usage_records 
ADD COLUMN IF NOT EXISTS sam_quota_impact INTEGER DEFAULT 0;

-- Update existing TrackedFeature enum to include sam_api_call
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'tracked_feature' 
    AND e.enumlabel = 'sam_api_call'
  ) THEN
    ALTER TYPE tracked_feature ADD VALUE 'sam_api_call';
  END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT, INSERT ON sam_api_usage TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_sam_quota_usage TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_sam_quota_usage TO authenticated;
GRANT EXECUTE ON FUNCTION get_sam_quota_analytics TO authenticated;

-- Comments for documentation
COMMENT ON TABLE sam_api_usage IS 'Tracks SAM.gov API usage for quota management and optimization';
COMMENT ON FUNCTION get_daily_sam_quota_usage IS 'Returns count of SAM.gov API calls for a specific date';
COMMENT ON FUNCTION get_hourly_sam_quota_usage IS 'Returns count of SAM.gov API calls for a specific hour';
COMMENT ON FUNCTION get_sam_quota_analytics IS 'Returns comprehensive analytics for SAM.gov API usage';
COMMENT ON FUNCTION cleanup_sam_api_usage IS 'Removes SAM.gov API usage records older than 90 days';