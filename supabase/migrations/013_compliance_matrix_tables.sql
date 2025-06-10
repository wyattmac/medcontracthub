-- Migration: Create compliance matrix tables for Section L/M tracking
-- Description: Adds tables to track RFP compliance requirements and responses

-- Create compliance_matrices table
CREATE TABLE IF NOT EXISTS public.compliance_matrices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  title TEXT NOT NULL,
  rfp_document_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
  metadata JSONB DEFAULT '{}',
  
  -- Add constraints
  CONSTRAINT compliance_matrices_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 255)
);

-- Create compliance_requirements table
CREATE TABLE IF NOT EXISTS public.compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_id UUID REFERENCES public.compliance_matrices(id) ON DELETE CASCADE NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('L', 'M', 'C', 'Other')),
  requirement_number TEXT NOT NULL,
  requirement_text TEXT NOT NULL,
  requirement_type TEXT CHECK (requirement_type IN ('submission', 'evaluation', 'technical', 'administrative', 'past_performance', 'pricing')),
  page_reference TEXT,
  is_mandatory BOOLEAN DEFAULT true,
  parent_requirement_id UUID REFERENCES public.compliance_requirements(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  extracted_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Add constraints
  CONSTRAINT compliance_requirements_number_format CHECK (requirement_number ~ '^[A-Z0-9\.\-]+$'),
  CONSTRAINT compliance_requirements_text_length CHECK (char_length(requirement_text) >= 10)
);

-- Create compliance_responses table
CREATE TABLE IF NOT EXISTS public.compliance_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID REFERENCES public.compliance_requirements(id) ON DELETE CASCADE NOT NULL,
  proposal_section TEXT,
  response_status TEXT DEFAULT 'not_started' CHECK (response_status IN ('not_started', 'in_progress', 'completed', 'not_applicable', 'deferred')),
  response_location TEXT,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique response per requirement
  CONSTRAINT compliance_responses_unique_requirement UNIQUE (requirement_id)
);

-- Create indexes for performance
CREATE INDEX idx_compliance_matrices_opportunity ON public.compliance_matrices(opportunity_id);
CREATE INDEX idx_compliance_matrices_status ON public.compliance_matrices(status);
CREATE INDEX idx_compliance_matrices_created_by ON public.compliance_matrices(created_by);

CREATE INDEX idx_compliance_requirements_matrix ON public.compliance_requirements(matrix_id);
CREATE INDEX idx_compliance_requirements_section ON public.compliance_requirements(section);
CREATE INDEX idx_compliance_requirements_parent ON public.compliance_requirements(parent_requirement_id);
CREATE INDEX idx_compliance_requirements_sort ON public.compliance_requirements(matrix_id, sort_order);

CREATE INDEX idx_compliance_responses_requirement ON public.compliance_responses(requirement_id);
CREATE INDEX idx_compliance_responses_status ON public.compliance_responses(response_status);
CREATE INDEX idx_compliance_responses_assigned ON public.compliance_responses(assigned_to);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_compliance_matrices_updated_at 
  BEFORE UPDATE ON public.compliance_matrices 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_requirements_updated_at 
  BEFORE UPDATE ON public.compliance_requirements 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_responses_updated_at 
  BEFORE UPDATE ON public.compliance_responses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE public.compliance_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_responses ENABLE ROW LEVEL SECURITY;

-- Compliance matrices policies
CREATE POLICY "Users can view their organization's compliance matrices" ON public.compliance_matrices
  FOR SELECT USING (
    created_by IN (
      SELECT id FROM public.users WHERE company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create compliance matrices" ON public.compliance_matrices
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their organization's compliance matrices" ON public.compliance_matrices
  FOR UPDATE USING (
    created_by IN (
      SELECT id FROM public.users WHERE company_id = (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own compliance matrices" ON public.compliance_matrices
  FOR DELETE USING (auth.uid() = created_by);

-- Compliance requirements policies (inherit from matrix permissions)
CREATE POLICY "Users can view requirements for accessible matrices" ON public.compliance_requirements
  FOR SELECT USING (
    matrix_id IN (
      SELECT id FROM public.compliance_matrices
      WHERE created_by IN (
        SELECT id FROM public.users WHERE company_id = (
          SELECT company_id FROM public.users WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage requirements for their matrices" ON public.compliance_requirements
  FOR ALL USING (
    matrix_id IN (
      SELECT id FROM public.compliance_matrices
      WHERE created_by IN (
        SELECT id FROM public.users WHERE company_id = (
          SELECT company_id FROM public.users WHERE id = auth.uid()
        )
      )
    )
  );

-- Compliance responses policies (inherit from requirement permissions)
CREATE POLICY "Users can view responses for accessible requirements" ON public.compliance_responses
  FOR SELECT USING (
    requirement_id IN (
      SELECT r.id FROM public.compliance_requirements r
      JOIN public.compliance_matrices m ON r.matrix_id = m.id
      WHERE m.created_by IN (
        SELECT id FROM public.users WHERE company_id = (
          SELECT company_id FROM public.users WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage responses for their requirements" ON public.compliance_responses
  FOR ALL USING (
    requirement_id IN (
      SELECT r.id FROM public.compliance_requirements r
      JOIN public.compliance_matrices m ON r.matrix_id = m.id
      WHERE m.created_by IN (
        SELECT id FROM public.users WHERE company_id = (
          SELECT company_id FROM public.users WHERE id = auth.uid()
        )
      )
    )
  );

-- Add helpful comments
COMMENT ON TABLE public.compliance_matrices IS 'Stores compliance matrices for tracking RFP Section L/M requirements';
COMMENT ON TABLE public.compliance_requirements IS 'Individual requirements extracted from RFP documents';
COMMENT ON TABLE public.compliance_responses IS 'Tracking of responses to each compliance requirement';

COMMENT ON COLUMN public.compliance_requirements.section IS 'RFP section: L (instructions), M (evaluation), C (contract clauses), Other';
COMMENT ON COLUMN public.compliance_requirements.requirement_type IS 'Type of requirement for categorization and filtering';
COMMENT ON COLUMN public.compliance_responses.response_status IS 'Current status of addressing this requirement';