-- Migration: Migration State Tracking
-- Description: Tables for tracking data migration progress and enabling resumable migrations

-- Create main migration state table
CREATE TABLE IF NOT EXISTS data_migration_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_name VARCHAR(100) NOT NULL UNIQUE,
  migration_type VARCHAR(50) NOT NULL CHECK (migration_type IN (
    'full_sync', 'incremental_sync', 'backfill', 'reindex', 'cleanup'
  )),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'opportunities', 'proposals', 'documents', 'saved_opportunities', 
    'compliance_matrices', 'users', 'companies', 'all'
  )),
  source_system VARCHAR(50) NOT NULL DEFAULT 'postgresql',
  target_system VARCHAR(50) NOT NULL CHECK (target_system IN (
    'kafka', 'clickhouse', 'weaviate', 'redis', 'all'
  )),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
  )),
  
  -- Progress tracking
  last_processed_id UUID,
  last_processed_timestamp TIMESTAMP WITH TIME ZONE,
  total_entities_estimate BIGINT,
  total_processed BIGINT DEFAULT 0,
  total_failed BIGINT DEFAULT 0,
  total_skipped BIGINT DEFAULT 0,
  
  -- Performance metrics
  processing_rate_per_second DECIMAL(10, 2),
  average_processing_time_ms DECIMAL(10, 2),
  
  -- Configuration
  batch_size INTEGER DEFAULT 1000,
  parallel_workers INTEGER DEFAULT 1,
  retry_failed BOOLEAN DEFAULT TRUE,
  dry_run BOOLEAN DEFAULT FALSE,
  config JSONB DEFAULT '{}',
  
  -- Error handling
  last_error_code VARCHAR(50),
  last_error_message TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  max_consecutive_failures INTEGER DEFAULT 10,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  resumed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_completion_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for querying
CREATE INDEX idx_migration_state_status ON data_migration_state(status, entity_type);
CREATE INDEX idx_migration_state_active ON data_migration_state(status) 
  WHERE status IN ('running', 'paused');

-- Create migration checkpoints table for resumability
CREATE TABLE IF NOT EXISTS migration_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_id UUID NOT NULL REFERENCES data_migration_state(id) ON DELETE CASCADE,
  checkpoint_number BIGINT NOT NULL,
  
  -- Checkpoint data
  processed_ids UUID[] NOT NULL,
  checkpoint_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  entities_in_batch INTEGER NOT NULL,
  
  -- State snapshot
  last_successful_id UUID,
  total_processed_at_checkpoint BIGINT NOT NULL,
  processing_metadata JSONB DEFAULT '{}',
  
  -- Performance at checkpoint
  batch_processing_time_ms INTEGER,
  entities_per_second DECIMAL(10, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(migration_id, checkpoint_number)
);

-- Create index for efficient checkpoint retrieval
CREATE INDEX idx_checkpoint_migration ON migration_checkpoints(migration_id, checkpoint_number DESC);

-- Create failed entities tracking table
CREATE TABLE IF NOT EXISTS migration_failed_entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_id UUID NOT NULL REFERENCES data_migration_state(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  
  -- Error details
  error_code VARCHAR(50) NOT NULL,
  error_message TEXT,
  error_details JSONB DEFAULT '{}',
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  retry_after TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status VARCHAR(20) DEFAULT 'failed' CHECK (status IN (
    'failed', 'retrying', 'resolved', 'skipped'
  )),
  
  failed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(migration_id, entity_id)
);

-- Create indexes for failed entities
CREATE INDEX idx_failed_entities_migration ON migration_failed_entities(migration_id, status);
CREATE INDEX idx_failed_entities_retry ON migration_failed_entities(retry_after, status) 
  WHERE status = 'failed' AND retry_count < max_retries;

-- Create migration metrics table for monitoring
CREATE TABLE IF NOT EXISTS migration_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_id UUID NOT NULL REFERENCES data_migration_state(id) ON DELETE CASCADE,
  metric_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Progress metrics
  entities_processed BIGINT NOT NULL,
  entities_failed BIGINT NOT NULL,
  entities_skipped BIGINT NOT NULL,
  
  -- Performance metrics
  processing_rate_per_second DECIMAL(10, 2),
  average_latency_ms DECIMAL(10, 2),
  p95_latency_ms DECIMAL(10, 2),
  p99_latency_ms DECIMAL(10, 2),
  
  -- Resource metrics
  memory_usage_mb DECIMAL(10, 2),
  cpu_usage_percent DECIMAL(5, 2),
  
  -- System metrics
  kafka_lag BIGINT,
  database_connections INTEGER,
  
  -- Additional metrics as JSONB
  custom_metrics JSONB DEFAULT '{}'
);

-- Create index for time-series queries
CREATE INDEX idx_migration_metrics_time ON migration_metrics(migration_id, metric_timestamp DESC);

-- Function to start or resume a migration
CREATE OR REPLACE FUNCTION start_migration(
  p_migration_name VARCHAR,
  p_migration_type VARCHAR,
  p_entity_type VARCHAR,
  p_target_system VARCHAR,
  p_config JSONB DEFAULT '{}',
  p_dry_run BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  v_migration_id UUID;
  v_existing_status VARCHAR;
BEGIN
  -- Check if migration exists
  SELECT id, status INTO v_migration_id, v_existing_status
  FROM data_migration_state
  WHERE migration_name = p_migration_name;
  
  IF v_migration_id IS NOT NULL THEN
    -- Resume existing migration
    IF v_existing_status NOT IN ('paused', 'failed') THEN
      RAISE EXCEPTION 'Migration % is already %', p_migration_name, v_existing_status;
    END IF;
    
    UPDATE data_migration_state
    SET status = 'running',
        resumed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_migration_id;
  ELSE
    -- Create new migration
    INSERT INTO data_migration_state (
      migration_name,
      migration_type,
      entity_type,
      target_system,
      config,
      dry_run,
      status,
      started_at
    ) VALUES (
      p_migration_name,
      p_migration_type,
      p_entity_type,
      p_target_system,
      p_config,
      p_dry_run,
      'running',
      CURRENT_TIMESTAMP
    ) RETURNING id INTO v_migration_id;
  END IF;
  
  RETURN v_migration_id;
END;
$$ LANGUAGE plpgsql;

-- Function to save migration checkpoint
CREATE OR REPLACE FUNCTION save_migration_checkpoint(
  p_migration_id UUID,
  p_processed_ids UUID[],
  p_last_successful_id UUID,
  p_batch_time_ms INTEGER
) RETURNS BIGINT AS $$
DECLARE
  v_checkpoint_number BIGINT;
  v_total_processed BIGINT;
  v_rate DECIMAL(10, 2);
BEGIN
  -- Get current total processed
  SELECT total_processed INTO v_total_processed
  FROM data_migration_state
  WHERE id = p_migration_id;
  
  -- Calculate processing rate
  IF p_batch_time_ms > 0 THEN
    v_rate := (array_length(p_processed_ids, 1) * 1000.0) / p_batch_time_ms;
  ELSE
    v_rate := 0;
  END IF;
  
  -- Get next checkpoint number
  SELECT COALESCE(MAX(checkpoint_number), 0) + 1 INTO v_checkpoint_number
  FROM migration_checkpoints
  WHERE migration_id = p_migration_id;
  
  -- Insert checkpoint
  INSERT INTO migration_checkpoints (
    migration_id,
    checkpoint_number,
    processed_ids,
    checkpoint_timestamp,
    entities_in_batch,
    last_successful_id,
    total_processed_at_checkpoint,
    batch_processing_time_ms,
    entities_per_second
  ) VALUES (
    p_migration_id,
    v_checkpoint_number,
    p_processed_ids,
    CURRENT_TIMESTAMP,
    array_length(p_processed_ids, 1),
    p_last_successful_id,
    v_total_processed + array_length(p_processed_ids, 1),
    p_batch_time_ms,
    v_rate
  );
  
  -- Update migration state
  UPDATE data_migration_state
  SET last_processed_id = p_last_successful_id,
      last_processed_timestamp = CURRENT_TIMESTAMP,
      total_processed = total_processed + array_length(p_processed_ids, 1),
      processing_rate_per_second = v_rate,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_migration_id;
  
  RETURN v_checkpoint_number;
END;
$$ LANGUAGE plpgsql;

-- Function to track failed entity
CREATE OR REPLACE FUNCTION track_migration_failure(
  p_migration_id UUID,
  p_entity_id UUID,
  p_entity_type VARCHAR,
  p_error_code VARCHAR,
  p_error_message TEXT,
  p_error_details JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO migration_failed_entities (
    migration_id,
    entity_id,
    entity_type,
    error_code,
    error_message,
    error_details,
    retry_after
  ) VALUES (
    p_migration_id,
    p_entity_id,
    p_entity_type,
    p_error_code,
    p_error_message,
    p_error_details,
    CURRENT_TIMESTAMP + INTERVAL '5 minutes'
  )
  ON CONFLICT (migration_id, entity_id) DO UPDATE
  SET retry_count = migration_failed_entities.retry_count + 1,
      last_retry_at = CURRENT_TIMESTAMP,
      error_code = EXCLUDED.error_code,
      error_message = EXCLUDED.error_message,
      error_details = EXCLUDED.error_details,
      retry_after = CASE 
        WHEN migration_failed_entities.retry_count < 3 
        THEN CURRENT_TIMESTAMP + (INTERVAL '5 minutes' * (migration_failed_entities.retry_count + 1))
        ELSE NULL
      END,
      status = CASE 
        WHEN migration_failed_entities.retry_count >= migration_failed_entities.max_retries 
        THEN 'skipped'
        ELSE 'failed'
      END;
  
  -- Update migration state
  UPDATE data_migration_state
  SET total_failed = total_failed + 1,
      consecutive_failures = consecutive_failures + 1,
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_migration_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get migration progress
CREATE OR REPLACE FUNCTION get_migration_progress(p_migration_id UUID)
RETURNS TABLE (
  migration_name VARCHAR,
  status VARCHAR,
  progress_percentage DECIMAL(5, 2),
  entities_processed BIGINT,
  entities_failed BIGINT,
  processing_rate DECIMAL(10, 2),
  estimated_completion TIMESTAMP WITH TIME ZONE,
  last_error TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dms.migration_name,
    dms.status,
    CASE 
      WHEN dms.total_entities_estimate > 0 
      THEN (dms.total_processed * 100.0 / dms.total_entities_estimate)::DECIMAL(5, 2)
      ELSE 0
    END as progress_percentage,
    dms.total_processed as entities_processed,
    dms.total_failed as entities_failed,
    dms.processing_rate_per_second as processing_rate,
    CASE 
      WHEN dms.processing_rate_per_second > 0 AND dms.total_entities_estimate > dms.total_processed
      THEN CURRENT_TIMESTAMP + 
        (INTERVAL '1 second' * ((dms.total_entities_estimate - dms.total_processed) / dms.processing_rate_per_second))
      ELSE NULL
    END as estimated_completion,
    dms.last_error_message as last_error
  FROM data_migration_state dms
  WHERE dms.id = p_migration_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update timestamp
CREATE TRIGGER update_migration_state_timestamp
  BEFORE UPDATE ON data_migration_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON data_migration_state TO authenticated;
GRANT SELECT ON migration_checkpoints TO authenticated;
GRANT SELECT ON migration_failed_entities TO authenticated;
GRANT SELECT ON migration_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_migration_progress TO authenticated;

-- Note: Other functions are restricted to service role for security