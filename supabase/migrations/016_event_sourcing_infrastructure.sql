-- Migration: Event Sourcing Infrastructure
-- Description: Core tables and infrastructure for event-driven microservices architecture

-- Create event store table for storing all domain events
CREATE TABLE IF NOT EXISTS event_store (
  event_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_version INTEGER NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  correlation_id UUID,
  causation_id UUID,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure events are ordered correctly per aggregate
  CONSTRAINT unique_aggregate_version UNIQUE(aggregate_id, event_version)
);

-- Create indexes for efficient querying
CREATE INDEX idx_event_store_aggregate ON event_store(aggregate_id, event_version);
CREATE INDEX idx_event_store_type ON event_store(event_type, created_at);
CREATE INDEX idx_event_store_correlation ON event_store(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_event_store_user ON event_store(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX idx_event_store_created ON event_store(created_at DESC);

-- Create event snapshots table for performance optimization
CREATE TABLE IF NOT EXISTS event_snapshots (
  snapshot_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  snapshot_version INTEGER NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Only one snapshot per version
  CONSTRAINT unique_snapshot_version UNIQUE(aggregate_id, snapshot_version)
);

CREATE INDEX idx_snapshots_aggregate ON event_snapshots(aggregate_id, snapshot_version DESC);

-- Create outbox table for reliable event publishing to Kafka
CREATE TABLE IF NOT EXISTS event_outbox (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  topic VARCHAR(100) NOT NULL,
  partition_key VARCHAR(100),
  payload JSONB NOT NULL,
  headers JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'dead_letter')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP WITH TIME ZONE,
  
  -- Add expiry for cleanup
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days')
);

-- Indexes for outbox processing
CREATE INDEX idx_outbox_status ON event_outbox(status, next_retry_at) 
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_outbox_aggregate ON event_outbox(aggregate_id);
CREATE INDEX idx_outbox_created ON event_outbox(created_at DESC);
CREATE INDEX idx_outbox_expires ON event_outbox(expires_at) 
  WHERE status = 'published';

-- Create event type registry for validation
CREATE TABLE IF NOT EXISTS event_type_registry (
  event_type VARCHAR(100) PRIMARY KEY,
  aggregate_type VARCHAR(100) NOT NULL,
  schema_version INTEGER DEFAULT 1,
  json_schema JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sample event types
INSERT INTO event_type_registry (event_type, aggregate_type, json_schema, description) VALUES
('OpportunityCreated', 'Opportunity', '{
  "type": "object",
  "required": ["noticeId", "title", "agency"],
  "properties": {
    "noticeId": {"type": "string"},
    "title": {"type": "string"},
    "agency": {"type": "string"},
    "noticeType": {"type": "string"},
    "naicsCode": {"type": "string"},
    "setAsideType": {"type": "string"},
    "responseDeadline": {"type": "string", "format": "date-time"}
  }
}'::jsonb, 'New opportunity discovered from SAM.gov'),

('OpportunityUpdated', 'Opportunity', '{
  "type": "object",
  "required": ["changes"],
  "properties": {
    "changes": {"type": "object"},
    "updatedFields": {"type": "array", "items": {"type": "string"}}
  }
}'::jsonb, 'Opportunity details updated'),

('OpportunitySaved', 'SavedOpportunity', '{
  "type": "object",
  "required": ["opportunityId", "userId", "companyId"],
  "properties": {
    "opportunityId": {"type": "string"},
    "userId": {"type": "string"},
    "companyId": {"type": "string"},
    "notes": {"type": "string"},
    "tags": {"type": "array", "items": {"type": "string"}}
  }
}'::jsonb, 'User saved an opportunity'),

('ProposalCreated', 'Proposal', '{
  "type": "object",
  "required": ["opportunityId", "companyId", "title"],
  "properties": {
    "opportunityId": {"type": "string"},
    "companyId": {"type": "string"},
    "title": {"type": "string"},
    "status": {"type": "string"}
  }
}'::jsonb, 'New proposal created'),

('DocumentProcessed', 'Document', '{
  "type": "object",
  "required": ["documentId", "documentType", "processingResult"],
  "properties": {
    "documentId": {"type": "string"},
    "documentType": {"type": "string"},
    "processingResult": {"type": "string"},
    "extractedText": {"type": "string"},
    "processingTimeMs": {"type": "integer"}
  }
}'::jsonb, 'Document OCR processing completed');

-- Create saga state table for distributed transactions
CREATE TABLE IF NOT EXISTS saga_state (
  saga_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  saga_type VARCHAR(100) NOT NULL,
  current_step VARCHAR(100) NOT NULL,
  saga_data JSONB NOT NULL,
  compensations JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'compensating')),
  correlation_id UUID,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_details JSONB
);

CREATE INDEX idx_saga_status ON saga_state(status, started_at) WHERE status IN ('running', 'compensating');
CREATE INDEX idx_saga_correlation ON saga_state(correlation_id) WHERE correlation_id IS NOT NULL;

-- Function to append events maintaining version consistency
CREATE OR REPLACE FUNCTION append_event(
  p_aggregate_id UUID,
  p_aggregate_type VARCHAR,
  p_event_type VARCHAR,
  p_event_data JSONB,
  p_metadata JSONB DEFAULT '{}',
  p_correlation_id UUID DEFAULT NULL,
  p_causation_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_next_version INTEGER;
  v_topic VARCHAR;
BEGIN
  -- Get next version number with lock
  SELECT COALESCE(MAX(event_version), 0) + 1 INTO v_next_version
  FROM event_store
  WHERE aggregate_id = p_aggregate_id
  FOR UPDATE;
  
  -- Insert event
  INSERT INTO event_store (
    aggregate_id,
    aggregate_type,
    event_type,
    event_version,
    event_data,
    metadata,
    correlation_id,
    causation_id,
    user_id
  ) VALUES (
    p_aggregate_id,
    p_aggregate_type,
    p_event_type,
    v_next_version,
    p_event_data,
    p_metadata,
    p_correlation_id,
    p_causation_id,
    p_user_id
  ) RETURNING event_id INTO v_event_id;
  
  -- Determine Kafka topic based on aggregate type
  v_topic := CASE p_aggregate_type
    WHEN 'Opportunity' THEN 'contracts.opportunities.events'
    WHEN 'Proposal' THEN 'contracts.proposals.events'
    WHEN 'Document' THEN 'contracts.documents.events'
    WHEN 'SavedOpportunity' THEN 'contracts.saved-opportunities.events'
    ELSE 'contracts.domain.events'
  END;
  
  -- Add to outbox for Kafka publishing
  INSERT INTO event_outbox (
    aggregate_id,
    event_type,
    topic,
    partition_key,
    payload,
    headers
  ) VALUES (
    p_aggregate_id,
    p_event_type,
    v_topic,
    p_aggregate_id::TEXT,
    jsonb_build_object(
      'eventId', v_event_id,
      'aggregateId', p_aggregate_id,
      'aggregateType', p_aggregate_type,
      'eventType', p_event_type,
      'eventVersion', v_next_version,
      'eventData', p_event_data,
      'metadata', p_metadata,
      'timestamp', CURRENT_TIMESTAMP
    ),
    jsonb_build_object(
      'correlation-id', COALESCE(p_correlation_id::TEXT, ''),
      'causation-id', COALESCE(p_causation_id::TEXT, v_event_id::TEXT),
      'user-id', COALESCE(p_user_id::TEXT, ''),
      'event-version', v_next_version::TEXT
    )
  );
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get aggregate state by replaying events
CREATE OR REPLACE FUNCTION get_aggregate_state(
  p_aggregate_id UUID,
  p_to_version INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_state JSONB := '{}'::jsonb;
  v_event RECORD;
BEGIN
  -- Check for snapshot
  SELECT snapshot_data INTO v_state
  FROM event_snapshots
  WHERE aggregate_id = p_aggregate_id
    AND (p_to_version IS NULL OR snapshot_version <= p_to_version)
  ORDER BY snapshot_version DESC
  LIMIT 1;
  
  -- Replay events from snapshot
  FOR v_event IN
    SELECT event_type, event_data, event_version
    FROM event_store
    WHERE aggregate_id = p_aggregate_id
      AND event_version > COALESCE((
        SELECT snapshot_version 
        FROM event_snapshots 
        WHERE aggregate_id = p_aggregate_id
          AND (p_to_version IS NULL OR snapshot_version <= p_to_version)
        ORDER BY snapshot_version DESC 
        LIMIT 1
      ), 0)
      AND (p_to_version IS NULL OR event_version <= p_to_version)
    ORDER BY event_version
  LOOP
    -- Apply event to state (simplified - in practice would use event handlers)
    v_state := v_state || v_event.event_data;
  END LOOP;
  
  RETURN v_state;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_event_registry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_registry_updated_at
  BEFORE UPDATE ON event_type_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_event_registry_timestamp();

-- Grant permissions
GRANT SELECT ON event_store TO authenticated;
GRANT SELECT ON event_snapshots TO authenticated;
GRANT SELECT ON event_type_registry TO authenticated;
GRANT EXECUTE ON FUNCTION append_event TO authenticated;
GRANT EXECUTE ON FUNCTION get_aggregate_state TO authenticated;

-- Note: event_outbox is only accessible by service role for processing