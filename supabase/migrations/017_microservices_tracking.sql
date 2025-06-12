-- Migration: Microservices Tracking
-- Description: Add service tracking columns to existing tables and create processing log

-- Add service tracking columns to opportunities table
ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS processed_by_services JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_sync_to_kafka TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS embedding_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS analytics_sync_status VARCHAR(20) DEFAULT 'pending' 
  CHECK (analytics_sync_status IN ('pending', 'synced', 'failed', 'skipped')),
ADD COLUMN IF NOT EXISTS event_stream_position BIGINT;

-- Create index for finding unsynced opportunities
CREATE INDEX idx_opportunities_sync_status ON opportunities(analytics_sync_status, last_sync_to_kafka)
  WHERE analytics_sync_status IN ('pending', 'failed');

-- Add service tracking to proposals table
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS event_stream_position BIGINT,
ADD COLUMN IF NOT EXISTS analytics_synced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_analysis_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_event_id UUID;

-- Add service tracking to contract_documents table
ALTER TABLE contract_documents
ADD COLUMN IF NOT EXISTS ocr_service_version VARCHAR(20),
ADD COLUMN IF NOT EXISTS processing_correlation_id UUID,
ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) DEFAULT 'pending'
  CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
ADD COLUMN IF NOT EXISTS processing_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS extracted_metadata JSONB DEFAULT '{}';

-- Create index for OCR processing queue
CREATE INDEX idx_contract_documents_processing ON contract_documents(processing_status, created_at)
  WHERE processing_status IN ('pending', 'retry');

-- Add tracking to saved_opportunities
ALTER TABLE saved_opportunities
ADD COLUMN IF NOT EXISTS realtime_sync_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_notification_sent TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_metadata JSONB DEFAULT '{}';

-- Add tracking to compliance_matrices
ALTER TABLE compliance_matrices
ADD COLUMN IF NOT EXISTS ai_extraction_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_correlation_id UUID,
ADD COLUMN IF NOT EXISTS kafka_offset BIGINT;

-- Create service processing log table
CREATE TABLE IF NOT EXISTS service_processing_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'opportunity', 'proposal', 'document', 'compliance_matrix', 'saved_opportunity'
  )),
  service_name VARCHAR(50) NOT NULL CHECK (service_name IN (
    'ocr-service', 'ai-service', 'analytics-service', 'realtime-service', 'worker-service'
  )),
  action VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'started', 'completed', 'failed', 'retry', 'skipped'
  )),
  correlation_id UUID,
  request_id UUID,
  processing_time_ms INTEGER,
  input_size_bytes INTEGER,
  output_size_bytes INTEGER,
  error_code VARCHAR(50),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient querying
CREATE INDEX idx_processing_log_entity ON service_processing_log(entity_id, entity_type, service_name);
CREATE INDEX idx_processing_log_correlation ON service_processing_log(correlation_id) 
  WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_processing_log_status ON service_processing_log(status, created_at)
  WHERE status IN ('failed', 'retry');
CREATE INDEX idx_processing_log_service ON service_processing_log(service_name, created_at DESC);

-- Create service health tracking table
CREATE TABLE IF NOT EXISTS service_health_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name VARCHAR(50) NOT NULL,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN (
    'processing_rate', 'error_rate', 'latency_p99', 'queue_depth', 'memory_usage', 'cpu_usage'
  )),
  metric_value DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_health_metrics_service ON service_health_metrics(service_name, metric_type, measured_at DESC);

-- Create data sync tracking table
CREATE TABLE IF NOT EXISTS data_sync_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_system VARCHAR(50) NOT NULL,
  target_system VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  last_synced_id UUID,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  total_synced BIGINT DEFAULT 0,
  total_failed BIGINT DEFAULT 0,
  sync_cursor JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(source_system, target_system, entity_type)
);

-- Function to track service processing
CREATE OR REPLACE FUNCTION track_service_processing(
  p_entity_id UUID,
  p_entity_type VARCHAR,
  p_service_name VARCHAR,
  p_action VARCHAR,
  p_status VARCHAR,
  p_correlation_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check if this is completing a started process
  IF p_status = 'completed' OR p_status = 'failed' THEN
    SELECT created_at INTO v_start_time
    FROM service_processing_log
    WHERE entity_id = p_entity_id
      AND entity_type = p_entity_type
      AND service_name = p_service_name
      AND action = p_action
      AND status = 'started'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  -- Insert log entry
  INSERT INTO service_processing_log (
    entity_id,
    entity_type,
    service_name,
    action,
    status,
    correlation_id,
    metadata,
    processing_time_ms,
    completed_at
  ) VALUES (
    p_entity_id,
    p_entity_type,
    p_service_name,
    p_action,
    p_status,
    p_correlation_id,
    p_metadata,
    CASE 
      WHEN v_start_time IS NOT NULL 
      THEN EXTRACT(MILLISECONDS FROM (CURRENT_TIMESTAMP - v_start_time))::INTEGER
      ELSE NULL
    END,
    CASE 
      WHEN p_status IN ('completed', 'failed', 'skipped') 
      THEN CURRENT_TIMESTAMP 
      ELSE NULL 
    END
  ) RETURNING id INTO v_log_id;
  
  -- Update entity processed_by_services column
  IF p_status = 'completed' THEN
    CASE p_entity_type
      WHEN 'opportunity' THEN
        UPDATE opportunities
        SET processed_by_services = processed_by_services || 
          jsonb_build_object(p_service_name, jsonb_build_object(
            'processed_at', CURRENT_TIMESTAMP,
            'action', p_action,
            'version', COALESCE((processed_by_services->p_service_name->>'version')::int, 0) + 1
          ))
        WHERE id = p_entity_id;
        
      WHEN 'proposal' THEN
        UPDATE proposals
        SET processing_metadata = processing_metadata || 
          jsonb_build_object(p_service_name, jsonb_build_object(
            'processed_at', CURRENT_TIMESTAMP,
            'action', p_action
          ))
        WHERE id = p_entity_id;
        
      WHEN 'document' THEN
        UPDATE contract_documents
        SET processing_status = 'completed',
            processing_completed_at = CURRENT_TIMESTAMP
        WHERE id = p_entity_id;
    END CASE;
  END IF;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get service processing history
CREATE OR REPLACE FUNCTION get_service_processing_history(
  p_entity_id UUID,
  p_entity_type VARCHAR DEFAULT NULL
) RETURNS TABLE (
  service_name VARCHAR,
  action VARCHAR,
  status VARCHAR,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    spl.service_name,
    spl.action,
    spl.status,
    spl.processing_time_ms,
    spl.created_at,
    spl.error_message
  FROM service_processing_log spl
  WHERE spl.entity_id = p_entity_id
    AND (p_entity_type IS NULL OR spl.entity_type = p_entity_type)
  ORDER BY spl.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to update sync status
CREATE OR REPLACE FUNCTION update_sync_status(
  p_source VARCHAR,
  p_target VARCHAR,
  p_entity_type VARCHAR,
  p_last_id UUID,
  p_count INTEGER DEFAULT 1,
  p_failed INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  INSERT INTO data_sync_status (
    source_system,
    target_system,
    entity_type,
    last_synced_id,
    last_synced_at,
    total_synced,
    total_failed
  ) VALUES (
    p_source,
    p_target,
    p_entity_type,
    p_last_id,
    CURRENT_TIMESTAMP,
    p_count,
    p_failed
  )
  ON CONFLICT (source_system, target_system, entity_type) DO UPDATE
  SET 
    last_synced_id = EXCLUDED.last_synced_id,
    last_synced_at = EXCLUDED.last_synced_at,
    total_synced = data_sync_status.total_synced + EXCLUDED.total_synced,
    total_failed = data_sync_status.total_failed + EXCLUDED.total_failed,
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies
ALTER TABLE service_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sync_status ENABLE ROW LEVEL SECURITY;

-- Service accounts can write, authenticated users can read their own data
CREATE POLICY "Service accounts can insert processing logs"
  ON service_processing_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can view processing logs for their entities"
  ON service_processing_log FOR SELECT
  USING (
    CASE entity_type
      WHEN 'opportunity' THEN EXISTS (
        SELECT 1 FROM saved_opportunities so
        JOIN profiles p ON p.id = auth.uid()
        WHERE so.opportunity_id = entity_id
          AND so.company_id = p.company_id
      )
      WHEN 'proposal' THEN EXISTS (
        SELECT 1 FROM proposals pr
        JOIN profiles p ON p.id = auth.uid()
        WHERE pr.id = entity_id
          AND pr.company_id = p.company_id
      )
      ELSE false
    END
  );

-- Health metrics are public read
CREATE POLICY "Anyone can view health metrics"
  ON service_health_metrics FOR SELECT
  USING (true);

-- Sync status is admin only
CREATE POLICY "Only service role can manage sync status"
  ON data_sync_status FOR ALL
  TO service_role
  USING (true);

-- Grants
GRANT SELECT ON service_processing_log TO authenticated;
GRANT SELECT ON service_health_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION track_service_processing TO authenticated;
GRANT EXECUTE ON FUNCTION get_service_processing_history TO authenticated;