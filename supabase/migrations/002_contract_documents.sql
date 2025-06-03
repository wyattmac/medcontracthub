-- Contract Documents and Product Requirements Schema
-- For wholesale distributor AI features

-- Contract documents table
CREATE TABLE IF NOT EXISTS contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_result JSONB,
  extracted_requirements JSONB,
  processing_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product requirements extracted from documents
CREATE TABLE IF NOT EXISTS product_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES contract_documents(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  specifications JSONB NOT NULL DEFAULT '{}',
  quantity INTEGER,
  unit TEXT DEFAULT 'EA',
  required_certifications TEXT[] DEFAULT '{}',
  required_standards TEXT[] DEFAULT '{}',
  packaging_requirements TEXT,
  delivery_date DATE,
  match_confidence DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Supplier catalog for tracking discovered suppliers
CREATE TABLE IF NOT EXISTS supplier_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  website_url TEXT,
  contact_info JSONB DEFAULT '{}',
  reliability_score DECIMAL(3,2),
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  scraping_rules JSONB DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  specialties TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sourced products linking requirements to suppliers
CREATE TABLE IF NOT EXISTS sourced_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES product_requirements(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES supplier_catalog(id),
  product_name TEXT,
  product_url TEXT,
  specifications JSONB DEFAULT '{}',
  price_per_unit DECIMAL(10,2),
  minimum_order_quantity INTEGER,
  lead_time_days INTEGER,
  certifications TEXT[] DEFAULT '{}',
  match_score DECIMAL(3,2),
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sourcing reports for bid preparation
CREATE TABLE IF NOT EXISTS sourcing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES contract_documents(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  total_requirements INTEGER NOT NULL DEFAULT 0,
  requirements_sourced INTEGER NOT NULL DEFAULT 0,
  estimated_total_cost DECIMAL(12,2),
  profit_margin DECIMAL(5,2),
  suggested_bid_amount DECIMAL(12,2),
  report_data JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_contract_documents_opportunity ON contract_documents(opportunity_id);
CREATE INDEX idx_contract_documents_company ON contract_documents(company_id);
CREATE INDEX idx_contract_documents_ocr_status ON contract_documents(ocr_status);
CREATE INDEX idx_product_requirements_document ON product_requirements(document_id);
CREATE INDEX idx_sourced_products_requirement ON sourced_products(requirement_id);
CREATE INDEX idx_sourced_products_supplier ON sourced_products(supplier_id);
CREATE INDEX idx_sourcing_reports_opportunity ON sourcing_reports(opportunity_id);

-- Updated at triggers
CREATE TRIGGER update_contract_documents_updated_at
  BEFORE UPDATE ON contract_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_requirements_updated_at
  BEFORE UPDATE ON product_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_catalog_updated_at
  BEFORE UPDATE ON supplier_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sourced_products_updated_at
  BEFORE UPDATE ON sourced_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourced_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_reports ENABLE ROW LEVEL SECURITY;

-- Company members can view and manage their contract documents
CREATE POLICY "Company members can view contract documents"
  ON contract_documents FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Company members can insert contract documents"
  ON contract_documents FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Company members can update contract documents"
  ON contract_documents FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Product requirements are accessible through document ownership
CREATE POLICY "View product requirements through documents"
  ON product_requirements FOR SELECT
  USING (document_id IN (
    SELECT id FROM contract_documents WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Manage product requirements through documents"
  ON product_requirements FOR ALL
  USING (document_id IN (
    SELECT id FROM contract_documents WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- Supplier catalog is shared across all authenticated users (read-only)
CREATE POLICY "All users can view supplier catalog"
  ON supplier_catalog FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can manage supplier catalog
CREATE POLICY "Admins can manage supplier catalog"
  ON supplier_catalog FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- Sourced products follow requirement ownership
CREATE POLICY "View sourced products through requirements"
  ON sourced_products FOR SELECT
  USING (requirement_id IN (
    SELECT pr.id FROM product_requirements pr
    JOIN contract_documents cd ON pr.document_id = cd.id
    WHERE cd.company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Manage sourced products through requirements"
  ON sourced_products FOR ALL
  USING (requirement_id IN (
    SELECT pr.id FROM product_requirements pr
    JOIN contract_documents cd ON pr.document_id = cd.id
    WHERE cd.company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- Sourcing reports follow company ownership
CREATE POLICY "Company members can view sourcing reports"
  ON sourcing_reports FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Company members can create sourcing reports"
  ON sourcing_reports FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));