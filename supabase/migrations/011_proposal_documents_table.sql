-- Add proposal documents table for OCR document attachments
CREATE TABLE IF NOT EXISTS proposal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    document_size INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    document_url TEXT,
    extracted_text TEXT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_proposal_documents_proposal_id ON proposal_documents(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_documents_uploaded_by ON proposal_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_proposal_documents_created_at ON proposal_documents(created_at);

-- Add RLS policies
ALTER TABLE proposal_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access documents from their company's proposals
CREATE POLICY "Users can access their company's proposal documents" ON proposal_documents
    FOR ALL 
    USING (
        proposal_id IN (
            SELECT p.id 
            FROM proposals p
            JOIN profiles pr ON p.company_id = pr.company_id
            WHERE pr.id = auth.uid()
        )
    );

-- Policy: Users can insert documents for their company's proposals
CREATE POLICY "Users can insert documents for their company's proposals" ON proposal_documents
    FOR INSERT 
    WITH CHECK (
        proposal_id IN (
            SELECT p.id 
            FROM proposals p
            JOIN profiles pr ON p.company_id = pr.company_id
            WHERE pr.id = auth.uid()
        )
        AND uploaded_by = auth.uid()
    );

-- Add trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_proposal_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_proposal_documents_updated_at
    BEFORE UPDATE ON proposal_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_proposal_documents_updated_at();

-- Add comment
COMMENT ON TABLE proposal_documents IS 'Stores documents attached to proposals with OCR-extracted text';