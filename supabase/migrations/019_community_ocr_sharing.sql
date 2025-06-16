-- Migration: Community OCR Data Sharing
-- Description: Enable users to share and reuse OCR extractions to reduce processing costs

-- Create community extractions table for shared OCR results
CREATE TABLE IF NOT EXISTS community_extractions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Document identification (anonymized)
  document_fingerprint TEXT NOT NULL UNIQUE,
  document_type VARCHAR(50) NOT NULL,
  file_size_bytes BIGINT,
  page_count INTEGER,
  
  -- Extraction data
  extracted_text TEXT NOT NULL,
  structured_data JSONB NOT NULL DEFAULT '{}',
  extracted_requirements JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  
  -- Processing information
  ocr_model VARCHAR(50) NOT NULL,
  processing_time_ms INTEGER,
  extraction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Quality metrics
  confidence_score DECIMAL(3,2) DEFAULT 0.75 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  verification_count INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) CHECK (average_rating >= 0 AND average_rating <= 5),
  total_ratings INTEGER DEFAULT 0,
  
  -- Contribution tracking (anonymized)
  contributor_count INTEGER DEFAULT 1,
  first_contributed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Content hashes for deduplication
  text_hash VARCHAR(64) NOT NULL, -- SHA256 of normalized text
  structure_hash VARCHAR(64), -- Hash of document structure/layout
  perceptual_hash VARCHAR(64), -- For image similarity
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'removed')),
  flagged_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient searching
CREATE INDEX idx_community_extractions_fingerprint ON community_extractions(document_fingerprint);
CREATE INDEX idx_community_extractions_hashes ON community_extractions(text_hash, structure_hash);
CREATE INDEX idx_community_extractions_type_quality ON community_extractions(document_type, confidence_score DESC);
CREATE INDEX idx_community_extractions_usage ON community_extractions(usage_count DESC, average_rating DESC);
CREATE INDEX idx_community_extractions_date ON community_extractions(extraction_date DESC);

-- Create feedback table for quality ratings
CREATE TABLE IF NOT EXISTS extraction_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extraction_id UUID NOT NULL REFERENCES community_extractions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Feedback data
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  accuracy_score DECIMAL(3,2) CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
  completeness_score DECIMAL(3,2) CHECK (completeness_score >= 0 AND completeness_score <= 1),
  
  -- Specific feedback
  feedback_type VARCHAR(50) CHECK (feedback_type IN (
    'accurate', 'incomplete', 'incorrect', 'formatting_issues', 'other'
  )),
  feedback_text TEXT,
  corrections JSONB,
  
  -- Usage context
  used_for_opportunity_id UUID REFERENCES opportunities(id),
  resulted_in_proposal BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(extraction_id, user_id)
);

-- Create index for feedback queries
CREATE INDEX idx_extraction_feedback_extraction ON extraction_feedback(extraction_id);
CREATE INDEX idx_extraction_feedback_user ON extraction_feedback(user_id);

-- Create document fingerprints table for deduplication
CREATE TABLE IF NOT EXISTS document_fingerprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_document_id UUID REFERENCES contract_documents(id) ON DELETE CASCADE,
  
  -- Fingerprint data
  full_fingerprint TEXT NOT NULL,
  text_hash VARCHAR(64) NOT NULL,
  structure_hash VARCHAR(64),
  perceptual_hash VARCHAR(64),
  
  -- Similarity matching
  shingle_hashes TEXT[], -- For MinHash similarity
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(contract_document_id)
);

-- Create indexes for similarity searching
CREATE INDEX idx_document_fingerprints_hashes ON document_fingerprints(text_hash, structure_hash);
CREATE INDEX idx_document_fingerprints_contract ON document_fingerprints(contract_document_id);

-- Update contract_documents table for sharing
ALTER TABLE contract_documents 
ADD COLUMN IF NOT EXISTS share_to_community BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS community_extraction_id UUID REFERENCES community_extractions(id),
ADD COLUMN IF NOT EXISTS used_community_extraction BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS extraction_confidence DECIMAL(3,2);

-- Add contribution tracking to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS community_contribution_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_extractions_shared INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_extraction_uses INTEGER DEFAULT 0;

-- Create usage tracking for community extractions
CREATE TABLE IF NOT EXISTS community_extraction_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extraction_id UUID NOT NULL REFERENCES community_extractions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id),
  
  -- Usage details
  used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  used_for_opportunity_id UUID REFERENCES opportunities(id),
  saved_processing_time_ms INTEGER,
  saved_api_cost DECIMAL(10,4),
  
  -- Outcome tracking
  extraction_was_sufficient BOOLEAN,
  required_reprocessing BOOLEAN DEFAULT FALSE,
  
  UNIQUE(extraction_id, user_id, used_at)
);

-- Create index for usage analytics
CREATE INDEX idx_community_usage_extraction ON community_extraction_usage(extraction_id);
CREATE INDEX idx_community_usage_user ON community_extraction_usage(user_id);
CREATE INDEX idx_community_usage_date ON community_extraction_usage(used_at DESC);

-- Function to calculate document fingerprint
CREATE OR REPLACE FUNCTION calculate_document_fingerprint(
  p_text TEXT,
  p_metadata JSONB
) RETURNS TEXT AS $$
DECLARE
  v_normalized_text TEXT;
  v_fingerprint TEXT;
BEGIN
  -- Normalize text (remove extra whitespace, lowercase)
  v_normalized_text := regexp_replace(lower(trim(p_text)), '\s+', ' ', 'g');
  
  -- Create composite fingerprint
  v_fingerprint := encode(
    digest(
      v_normalized_text || 
      COALESCE(p_metadata->>'structure', '') ||
      COALESCE(p_metadata->>'type', ''),
      'sha256'
    ),
    'hex'
  );
  
  RETURN substring(v_fingerprint, 1, 16); -- Use first 16 chars for efficiency
END;
$$ LANGUAGE plpgsql;

-- Function to share extraction to community
CREATE OR REPLACE FUNCTION share_extraction_to_community(
  p_contract_document_id UUID,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_doc RECORD;
  v_fingerprint TEXT;
  v_extraction_id UUID;
  v_text_hash VARCHAR(64);
BEGIN
  -- Get document data
  SELECT * INTO v_doc
  FROM contract_documents
  WHERE id = p_contract_document_id
    AND ocr_status = 'completed'
    AND ocr_result IS NOT NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or not processed';
  END IF;
  
  -- Calculate fingerprint
  v_fingerprint := calculate_document_fingerprint(
    v_doc.extracted_text,
    v_doc.metadata
  );
  
  -- Calculate text hash
  v_text_hash := encode(digest(v_doc.extracted_text, 'sha256'), 'hex');
  
  -- Check if already exists
  SELECT id INTO v_extraction_id
  FROM community_extractions
  WHERE document_fingerprint = v_fingerprint;
  
  IF v_extraction_id IS NOT NULL THEN
    -- Update existing extraction
    UPDATE community_extractions
    SET contributor_count = contributor_count + 1,
        verification_count = verification_count + 1,
        confidence_score = LEAST(confidence_score + 0.05, 1.0),
        last_verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_extraction_id;
  ELSE
    -- Create new community extraction
    INSERT INTO community_extractions (
      document_fingerprint,
      document_type,
      file_size_bytes,
      page_count,
      extracted_text,
      structured_data,
      extracted_requirements,
      metadata,
      ocr_model,
      processing_time_ms,
      text_hash,
      confidence_score
    ) VALUES (
      v_fingerprint,
      v_doc.file_type,
      v_doc.file_size,
      (v_doc.metadata->>'pageCount')::INTEGER,
      v_doc.extracted_text,
      v_doc.structured_data,
      v_doc.extracted_requirements,
      jsonb_build_object(
        'source', 'user_contribution',
        'originalType', v_doc.file_type
      ),
      COALESCE(v_doc.metadata->>'model', 'unknown'),
      v_doc.processing_time_ms,
      v_text_hash,
      0.75
    ) RETURNING id INTO v_extraction_id;
  END IF;
  
  -- Update contract document
  UPDATE contract_documents
  SET share_to_community = TRUE,
      community_extraction_id = v_extraction_id
  WHERE id = p_contract_document_id;
  
  -- Update user contribution score
  UPDATE profiles
  SET community_contribution_score = community_contribution_score + 10,
      total_extractions_shared = total_extractions_shared + 1
  WHERE id = p_user_id;
  
  -- Store fingerprint
  INSERT INTO document_fingerprints (
    contract_document_id,
    full_fingerprint,
    text_hash
  ) VALUES (
    p_contract_document_id,
    v_fingerprint,
    v_text_hash
  ) ON CONFLICT (contract_document_id) DO UPDATE
  SET full_fingerprint = EXCLUDED.full_fingerprint,
      text_hash = EXCLUDED.text_hash;
  
  RETURN v_extraction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar community extractions
CREATE OR REPLACE FUNCTION find_similar_extractions(
  p_text_sample TEXT,
  p_document_type VARCHAR DEFAULT NULL,
  p_threshold DECIMAL DEFAULT 0.8
) RETURNS TABLE (
  extraction_id UUID,
  similarity_score DECIMAL,
  confidence_score DECIMAL,
  usage_count INTEGER
) AS $$
DECLARE
  v_sample_hash VARCHAR(64);
BEGIN
  -- Calculate hash of sample text
  v_sample_hash := encode(digest(
    regexp_replace(lower(trim(p_text_sample)), '\s+', ' ', 'g'),
    'sha256'
  ), 'hex');
  
  -- Find similar extractions
  RETURN QUERY
  SELECT 
    ce.id as extraction_id,
    1.0 as similarity_score, -- Exact match
    ce.confidence_score,
    ce.usage_count
  FROM community_extractions ce
  WHERE ce.text_hash = v_sample_hash
    AND ce.status = 'active'
    AND (p_document_type IS NULL OR ce.document_type = p_document_type)
  
  UNION
  
  -- Fuzzy matching would go here (simplified for now)
  SELECT 
    ce.id as extraction_id,
    0.9 as similarity_score,
    ce.confidence_score,
    ce.usage_count
  FROM community_extractions ce
  WHERE substring(ce.text_hash, 1, 8) = substring(v_sample_hash, 1, 8)
    AND ce.status = 'active'
    AND (p_document_type IS NULL OR ce.document_type = p_document_type)
    AND ce.id NOT IN (
      SELECT id FROM community_extractions WHERE text_hash = v_sample_hash
    )
  
  ORDER BY similarity_score DESC, confidence_score DESC, usage_count DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to record extraction usage
CREATE OR REPLACE FUNCTION record_extraction_usage(
  p_extraction_id UUID,
  p_user_id UUID,
  p_opportunity_id UUID DEFAULT NULL,
  p_saved_time_ms INTEGER DEFAULT 0,
  p_saved_cost DECIMAL DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  -- Record usage
  INSERT INTO community_extraction_usage (
    extraction_id,
    user_id,
    used_for_opportunity_id,
    saved_processing_time_ms,
    saved_api_cost
  ) VALUES (
    p_extraction_id,
    p_user_id,
    p_opportunity_id,
    p_saved_time_ms,
    p_saved_cost
  );
  
  -- Update extraction usage count
  UPDATE community_extractions
  SET usage_count = usage_count + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_extraction_id;
  
  -- Update original contributor scores
  UPDATE profiles p
  SET total_extraction_uses = total_extraction_uses + 1,
      community_contribution_score = community_contribution_score + 1
  FROM contract_documents cd
  WHERE cd.community_extraction_id = p_extraction_id
    AND cd.share_to_community = TRUE
    AND p.id = cd.user_id;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies
ALTER TABLE community_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_extraction_usage ENABLE ROW LEVEL SECURITY;

-- Everyone can view active community extractions
CREATE POLICY "View active community extractions"
  ON community_extractions FOR SELECT
  USING (status = 'active' AND auth.uid() IS NOT NULL);

-- Users can provide feedback on extractions they've used
CREATE POLICY "Users can provide feedback"
  ON extraction_feedback FOR ALL
  USING (user_id = auth.uid());

-- Users can view their own fingerprints
CREATE POLICY "Users view own fingerprints"
  ON document_fingerprints FOR SELECT
  USING (
    contract_document_id IN (
      SELECT id FROM contract_documents
      WHERE user_id = auth.uid() OR company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can view their own usage
CREATE POLICY "Users view own usage"
  ON community_extraction_usage FOR SELECT
  USING (user_id = auth.uid());

-- Create triggers
CREATE TRIGGER update_community_extractions_timestamp
  BEFORE UPDATE ON community_extractions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create initial quality score calculation
CREATE OR REPLACE FUNCTION calculate_extraction_quality_score(
  p_extraction_id UUID
) RETURNS DECIMAL AS $$
DECLARE
  v_score DECIMAL;
  v_rating_weight DECIMAL := 0.4;
  v_usage_weight DECIMAL := 0.3;
  v_verification_weight DECIMAL := 0.3;
  v_record RECORD;
BEGIN
  SELECT 
    COALESCE(average_rating / 5.0, 0.75) as rating_score,
    LEAST(usage_count / 100.0, 1.0) as usage_score,
    LEAST(verification_count / 10.0, 1.0) as verification_score
  INTO v_record
  FROM community_extractions
  WHERE id = p_extraction_id;
  
  v_score := (v_record.rating_score * v_rating_weight) +
             (v_record.usage_score * v_usage_weight) +
             (v_record.verification_score * v_verification_weight);
  
  RETURN ROUND(v_score, 2);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON community_extractions TO authenticated;
GRANT INSERT, UPDATE ON extraction_feedback TO authenticated;
GRANT SELECT ON document_fingerprints TO authenticated;
GRANT SELECT, INSERT ON community_extraction_usage TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_extractions TO authenticated;
GRANT EXECUTE ON FUNCTION share_extraction_to_community TO authenticated;
GRANT EXECUTE ON FUNCTION record_extraction_usage TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_extraction_quality_score TO authenticated;