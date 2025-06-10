-- Migration: Proposal Learning System Tables
-- Description: Tables for tracking proposal outcomes and learning patterns

-- Create proposal_outcomes table
CREATE TABLE IF NOT EXISTS proposal_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'pending', 'withdrawn')),
  award_amount DECIMAL(15, 2),
  feedback JSONB DEFAULT '{}',
  lessons_learned JSONB DEFAULT '[]',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one outcome per proposal
  UNIQUE(proposal_id)
);

-- Create proposal_learning_patterns table
CREATE TABLE IF NOT EXISTS proposal_learning_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('win_factor', 'loss_factor', 'pricing_strategy', 'compliance_issue')),
  description TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  impact_score DECIMAL(3, 2) CHECK (impact_score >= -1 AND impact_score <= 1),
  applicable_conditions JSONB DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent duplicate patterns
  UNIQUE(pattern_type, description)
);

-- Create proposal_metrics table for aggregated company performance
CREATE TABLE IF NOT EXISTS proposal_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  total_proposals INTEGER DEFAULT 0,
  won_proposals INTEGER DEFAULT 0,
  lost_proposals INTEGER DEFAULT 0,
  withdrawn_proposals INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 4) DEFAULT 0,
  average_award_amount DECIMAL(15, 2) DEFAULT 0,
  average_score DECIMAL(5, 2) DEFAULT 0,
  common_strengths JSONB DEFAULT '[]',
  common_weaknesses JSONB DEFAULT '[]',
  agency_performance JSONB DEFAULT '{}',
  evaluation_factor_performance JSONB DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- One metrics record per company
  UNIQUE(company_id)
);

-- Create indexes for performance
CREATE INDEX idx_proposal_outcomes_proposal_id ON proposal_outcomes(proposal_id);
CREATE INDEX idx_proposal_outcomes_opportunity_id ON proposal_outcomes(opportunity_id);
CREATE INDEX idx_proposal_outcomes_outcome ON proposal_outcomes(outcome);
CREATE INDEX idx_proposal_outcomes_recorded_at ON proposal_outcomes(recorded_at DESC);

CREATE INDEX idx_learning_patterns_type ON proposal_learning_patterns(pattern_type);
CREATE INDEX idx_learning_patterns_impact ON proposal_learning_patterns(impact_score DESC);
CREATE INDEX idx_learning_patterns_conditions ON proposal_learning_patterns USING gin (applicable_conditions);

CREATE INDEX idx_proposal_metrics_company ON proposal_metrics(company_id);
CREATE INDEX idx_proposal_metrics_updated ON proposal_metrics(last_updated DESC);

-- Add RLS policies
ALTER TABLE proposal_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_metrics ENABLE ROW LEVEL SECURITY;

-- Proposal outcomes policies - users can only see their company's outcomes
CREATE POLICY "Users can view their company's proposal outcomes"
  ON proposal_outcomes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = proposal_outcomes.proposal_id
      AND prof.id = auth.uid()
    )
  );

CREATE POLICY "Users can create outcomes for their company's proposals"
  ON proposal_outcomes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals p
      JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = proposal_outcomes.proposal_id
      AND prof.id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's proposal outcomes"
  ON proposal_outcomes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      JOIN profiles prof ON prof.company_id = p.company_id
      WHERE p.id = proposal_outcomes.proposal_id
      AND prof.id = auth.uid()
    )
  );

-- Learning patterns are read-only for all authenticated users
CREATE POLICY "Authenticated users can view learning patterns"
  ON proposal_learning_patterns FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only system can manage learning patterns (through service role)
-- No user-level INSERT/UPDATE/DELETE policies

-- Proposal metrics policies - users can only see their company's metrics
CREATE POLICY "Users can view their company's metrics"
  ON proposal_metrics FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_proposal_outcomes_updated_at 
  BEFORE UPDATE ON proposal_outcomes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_patterns_updated_at 
  BEFORE UPDATE ON proposal_learning_patterns 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update proposal metrics when outcomes change
CREATE OR REPLACE FUNCTION update_proposal_metrics()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Get the company_id from the proposal
  SELECT p.company_id INTO v_company_id
  FROM proposals p
  WHERE p.id = NEW.proposal_id;

  -- Update or insert metrics
  INSERT INTO proposal_metrics (
    company_id,
    total_proposals,
    won_proposals,
    lost_proposals,
    withdrawn_proposals,
    win_rate,
    last_updated
  )
  VALUES (
    v_company_id,
    1,
    CASE WHEN NEW.outcome = 'won' THEN 1 ELSE 0 END,
    CASE WHEN NEW.outcome = 'lost' THEN 1 ELSE 0 END,
    CASE WHEN NEW.outcome = 'withdrawn' THEN 1 ELSE 0 END,
    CASE WHEN NEW.outcome = 'won' THEN 1.0 ELSE 0.0 END,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (company_id) DO UPDATE
  SET 
    total_proposals = proposal_metrics.total_proposals + 1,
    won_proposals = proposal_metrics.won_proposals + 
      CASE WHEN NEW.outcome = 'won' THEN 1 ELSE 0 END,
    lost_proposals = proposal_metrics.lost_proposals + 
      CASE WHEN NEW.outcome = 'lost' THEN 1 ELSE 0 END,
    withdrawn_proposals = proposal_metrics.withdrawn_proposals + 
      CASE WHEN NEW.outcome = 'withdrawn' THEN 1 ELSE 0 END,
    win_rate = CASE 
      WHEN proposal_metrics.total_proposals + 1 > 0 
      THEN (proposal_metrics.won_proposals + 
        CASE WHEN NEW.outcome = 'won' THEN 1 ELSE 0 END)::DECIMAL / 
        (proposal_metrics.total_proposals + 1)
      ELSE 0 
    END,
    last_updated = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_proposal_metrics
  AFTER INSERT OR UPDATE ON proposal_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_metrics();

-- Add outcome tracking columns to proposals table
ALTER TABLE proposals 
ADD COLUMN IF NOT EXISTS win_themes TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS discriminators TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}';

-- Grant necessary permissions
GRANT SELECT ON proposal_outcomes TO authenticated;
GRANT INSERT, UPDATE ON proposal_outcomes TO authenticated;
GRANT SELECT ON proposal_learning_patterns TO authenticated;
GRANT SELECT ON proposal_metrics TO authenticated;