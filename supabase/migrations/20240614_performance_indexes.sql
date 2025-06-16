-- Performance optimization indexes for sub-1 second loading times

-- Full-text search index on opportunities (using GIN for faster text search)
CREATE INDEX IF NOT EXISTS idx_opportunities_fulltext ON public.opportunities 
USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(agency, '')));

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_opportunities_search_filters ON public.opportunities(status, response_deadline DESC, posted_date DESC);

-- Partial index for active opportunities (most queries filter by active status)
CREATE INDEX IF NOT EXISTS idx_opportunities_active_deadline ON public.opportunities(response_deadline DESC) 
WHERE status = 'active';

-- Covering index for search queries to avoid table lookups
CREATE INDEX IF NOT EXISTS idx_opportunities_search_covering ON public.opportunities(
  status, 
  response_deadline, 
  posted_date, 
  naics_code, 
  place_of_performance_state
) INCLUDE (
  title, 
  agency, 
  estimated_value_min, 
  estimated_value_max,
  set_aside_type
);

-- Index for place of performance queries
CREATE INDEX IF NOT EXISTS idx_opportunities_location ON public.opportunities(place_of_performance_state, place_of_performance_city);

-- Index for value range queries
CREATE INDEX IF NOT EXISTS idx_opportunities_value ON public.opportunities(estimated_value_min, estimated_value_max);

-- Composite index for saved opportunities lookup
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_lookup ON public.saved_opportunities(user_id, opportunity_id);

-- Index for reminder queries
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_reminders ON public.saved_opportunities(reminder_date) 
WHERE reminder_date IS NOT NULL;

-- Materialized view for pre-calculated opportunity stats
CREATE MATERIALIZED VIEW IF NOT EXISTS opportunity_stats AS
SELECT 
  o.id,
  o.naics_code,
  COUNT(DISTINCT so.user_id) as save_count,
  AVG(CASE WHEN so.is_pursuing THEN 1 ELSE 0 END) as pursuit_rate
FROM opportunities o
LEFT JOIN saved_opportunities so ON o.id = so.opportunity_id
GROUP BY o.id, o.naics_code;

-- Index on the materialized view
CREATE INDEX IF NOT EXISTS idx_opportunity_stats_id ON opportunity_stats(id);

-- Function for fast match score calculation in database
CREATE OR REPLACE FUNCTION calculate_match_score(
  opportunity_naics TEXT,
  user_naics_codes TEXT[]
) RETURNS NUMERIC AS $$
DECLARE
  score NUMERIC := 0;
  naics_match BOOLEAN := FALSE;
BEGIN
  -- Direct NAICS match (100% score)
  IF opportunity_naics = ANY(user_naics_codes) THEN
    RETURN 1.0;
  END IF;
  
  -- Partial NAICS match (check first 4 digits - 80% score)
  FOR i IN 1..array_length(user_naics_codes, 1) LOOP
    IF LEFT(opportunity_naics, 4) = LEFT(user_naics_codes[i], 4) THEN
      score := GREATEST(score, 0.8);
      naics_match := TRUE;
    END IF;
  END LOOP;
  
  -- Industry group match (check first 3 digits - 60% score)
  IF NOT naics_match THEN
    FOR i IN 1..array_length(user_naics_codes, 1) LOOP
      IF LEFT(opportunity_naics, 3) = LEFT(user_naics_codes[i], 3) THEN
        score := GREATEST(score, 0.6);
        naics_match := TRUE;
      END IF;
    END LOOP;
  END IF;
  
  -- Subsector match (check first 2 digits - 40% score)
  IF NOT naics_match THEN
    FOR i IN 1..array_length(user_naics_codes, 1) LOOP
      IF LEFT(opportunity_naics, 2) = LEFT(user_naics_codes[i], 2) THEN
        score := GREATEST(score, 0.4);
      END IF;
    END LOOP;
  END IF;
  
  RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Refresh materialized view periodically (can be scheduled)
REFRESH MATERIALIZED VIEW CONCURRENTLY opportunity_stats;