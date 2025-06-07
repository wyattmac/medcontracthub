-- Update contract_documents table for SAM.gov attachment OCR processing
-- This migration adds fields needed for the Mistral OCR integration

-- Add new columns to contract_documents
ALTER TABLE contract_documents 
ADD COLUMN IF NOT EXISTS notice_id TEXT,
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS structured_data JSONB,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Make file_url and file_type nullable since we may process without storing files
ALTER TABLE contract_documents 
ALTER COLUMN file_url DROP NOT NULL,
ALTER COLUMN file_type DROP NOT NULL;

-- Update company_id to be nullable and add foreign key to users
ALTER TABLE contract_documents 
ALTER COLUMN company_id DROP NOT NULL;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_contract_documents_notice_id ON contract_documents(notice_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_user_id ON contract_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_processed_at ON contract_documents(processed_at);

-- Update RLS policies to include user-based access
CREATE POLICY "Users can view their own contract documents"
  ON contract_documents FOR SELECT
  USING (user_id = auth.uid() OR company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert their own contract documents"
  ON contract_documents FOR INSERT
  WITH CHECK (user_id = auth.uid() OR company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their own contract documents"
  ON contract_documents FOR UPDATE
  USING (user_id = auth.uid() OR company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Company members can view contract documents" ON contract_documents;
DROP POLICY IF EXISTS "Company members can insert contract documents" ON contract_documents;
DROP POLICY IF EXISTS "Company members can update contract documents" ON contract_documents;

-- Add comment to explain the dual purpose of this table
COMMENT ON TABLE contract_documents IS 'Stores both uploaded contract documents and OCR-processed SAM.gov attachments';