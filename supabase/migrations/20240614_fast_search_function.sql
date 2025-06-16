-- Fast search function for opportunities with database-side match scoring
-- This function replaces client-side processing for sub-300ms response times

CREATE OR REPLACE FUNCTION search_opportunities_fast(
  search_query TEXT DEFAULT '',
  status_filter TEXT DEFAULT NULL,
  naics_filter TEXT DEFAULT NULL,
  state_filter TEXT DEFAULT NULL,
  set_aside_filter TEXT DEFAULT NULL,
  agency_filter TEXT DEFAULT NULL,
  deadline_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  deadline_to TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  min_value NUMERIC DEFAULT NULL,
  max_value NUMERIC DEFAULT NULL,
  user_naics_codes TEXT[] DEFAULT ARRAY['339112', '423450', '621999'],
  user_id UUID DEFAULT NULL,
  sort_by TEXT DEFAULT 'relevance',
  limit_count INTEGER DEFAULT 25,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  notice_id TEXT,
  title TEXT,
  description TEXT,
  agency TEXT,
  sub_agency TEXT,
  office TEXT,
  posted_date TIMESTAMP WITH TIME ZONE,
  response_deadline TIMESTAMP WITH TIME ZONE,
  archive_date TIMESTAMP WITH TIME ZONE,
  naics_code TEXT,
  naics_description TEXT,
  place_of_performance_state TEXT,
  place_of_performance_city TEXT,
  set_aside_type TEXT,
  contract_type TEXT,
  estimated_value_min NUMERIC,
  estimated_value_max NUMERIC,
  award_date TIMESTAMP WITH TIME ZONE,
  award_amount NUMERIC,
  awardee_name TEXT,
  awardee_duns TEXT,
  status opportunity_status,
  solicitation_number TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  attachments JSONB,
  additional_info JSONB,
  sam_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  match_score NUMERIC,
  is_saved BOOLEAN,
  days_until_deadline INTEGER,
  is_recently_posted BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_opportunities AS (
    SELECT o.*
    FROM opportunities o
    WHERE 
      -- Status filter
      (status_filter IS NULL OR o.status = status_filter::opportunity_status)
      -- Full-text search (using GIN index)
      AND (search_query = '' OR 
           to_tsvector('english', coalesce(o.title, '') || ' ' || 
                      coalesce(o.description, '') || ' ' || 
                      coalesce(o.agency, '')) 
           @@ plainto_tsquery('english', search_query))
      -- NAICS filter
      AND (naics_filter IS NULL OR o.naics_code = naics_filter)
      -- State filter
      AND (state_filter IS NULL OR o.place_of_performance_state = state_filter)
      -- Set-aside filter
      AND (set_aside_filter IS NULL OR o.set_aside_type = set_aside_filter)
      -- Agency filter
      AND (agency_filter IS NULL OR o.agency ILIKE '%' || agency_filter || '%')
      -- Deadline filters
      AND (deadline_from IS NULL OR o.response_deadline >= deadline_from)
      AND (deadline_to IS NULL OR o.response_deadline <= deadline_to)
      -- Value filters
      AND (min_value IS NULL OR o.estimated_value_min >= min_value)
      AND (max_value IS NULL OR o.estimated_value_max <= max_value)
  ),
  scored_opportunities AS (
    SELECT 
      fo.*,
      calculate_match_score(fo.naics_code, user_naics_codes) as match_score,
      EXISTS(
        SELECT 1 FROM saved_opportunities so 
        WHERE so.opportunity_id = fo.id 
        AND so.user_id = search_opportunities_fast.user_id
      ) as is_saved,
      CASE 
        WHEN fo.response_deadline IS NOT NULL 
        THEN EXTRACT(DAY FROM (fo.response_deadline - NOW()))::INTEGER
        ELSE NULL 
      END as days_until_deadline,
      (NOW() - fo.posted_date) < INTERVAL '7 days' as is_recently_posted
    FROM filtered_opportunities fo
  )
  SELECT 
    so.id,
    so.notice_id,
    so.title,
    so.description,
    so.agency,
    so.sub_agency,
    so.office,
    so.posted_date,
    so.response_deadline,
    so.archive_date,
    so.naics_code,
    so.naics_description,
    so.place_of_performance_state,
    so.place_of_performance_city,
    so.set_aside_type,
    so.contract_type,
    so.estimated_value_min,
    so.estimated_value_max,
    so.award_date,
    so.award_amount,
    so.awardee_name,
    so.awardee_duns,
    so.status,
    so.solicitation_number,
    so.primary_contact_name,
    so.primary_contact_email,
    so.primary_contact_phone,
    so.attachments,
    so.additional_info,
    so.sam_url,
    so.created_at,
    so.updated_at,
    so.match_score,
    so.is_saved,
    so.days_until_deadline,
    so.is_recently_posted
  FROM scored_opportunities so
  ORDER BY
    CASE 
      WHEN sort_by = 'relevance' THEN so.match_score 
      WHEN sort_by = 'deadline' THEN EXTRACT(EPOCH FROM so.response_deadline)
      WHEN sort_by = 'posted' THEN EXTRACT(EPOCH FROM so.posted_date)
      WHEN sort_by = 'value' THEN so.estimated_value_max
      ELSE so.match_score
    END DESC NULLS LAST
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_opportunities_fast TO authenticated;
GRANT EXECUTE ON FUNCTION search_opportunities_fast TO anon;

-- Create index on function for better performance
COMMENT ON FUNCTION search_opportunities_fast IS 'Ultra-fast opportunity search with database-side match scoring';