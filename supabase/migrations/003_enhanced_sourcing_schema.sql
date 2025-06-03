-- Enhanced Sourcing Schema for Cost-Effective Processing
-- Additional tables and optimizations for the wholesale distributor AI

-- Document processing cache to avoid reprocessing
CREATE TABLE IF NOT EXISTS document_processing_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_url TEXT NOT NULL UNIQUE,
  document_hash TEXT NOT NULL, -- SHA-256 hash of document content
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days',
  ocr_result JSONB NOT NULL,
  extraction_version TEXT NOT NULL DEFAULT '1.0', -- Track extraction prompt versions
  processing_cost DECIMAL(10,4) DEFAULT 0, -- Track API costs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product catalog for normalized product data
CREATE TABLE IF NOT EXISTS product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, -- Standardized name for matching
  category TEXT NOT NULL,
  subcategory TEXT,
  manufacturer TEXT,
  manufacturer_part_number TEXT,
  gtin TEXT, -- Global Trade Item Number
  unspsc_code TEXT, -- United Nations Standard Products and Services Code
  common_specifications JSONB DEFAULT '{}',
  synonyms TEXT[] DEFAULT '{}', -- Alternative names
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Supplier pricing and availability
CREATE TABLE IF NOT EXISTS supplier_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_catalog(id) ON DELETE CASCADE,
  product_catalog_id UUID REFERENCES product_catalog(id),
  supplier_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  bulk_pricing JSONB DEFAULT '{}', -- {"100": 9.50, "500": 9.00, "1000": 8.50}
  availability_status TEXT NOT NULL DEFAULT 'in_stock',
  lead_time_days INTEGER DEFAULT 0,
  minimum_order_quantity INTEGER DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  price_valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing queue for batch operations
CREATE TABLE IF NOT EXISTS ocr_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cost tracking for API usage optimization
CREATE TABLE IF NOT EXISTS api_usage_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL, -- 'mistral_ocr', 'claude_ai', 'sam_gov'
  operation_type TEXT NOT NULL, -- 'ocr_process', 'ai_analysis', 'document_download'
  tokens_used INTEGER,
  pages_processed INTEGER,
  cost_usd DECIMAL(10,4) NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Supplier performance metrics
CREATE TABLE IF NOT EXISTS supplier_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_catalog(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'delivery_time', 'quality_score', 'response_rate'
  metric_value DECIMAL(10,2) NOT NULL,
  sample_size INTEGER DEFAULT 1,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bid preparation templates
CREATE TABLE IF NOT EXISTS bid_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'technical', 'simplified'
  sections JSONB NOT NULL DEFAULT '[]',
  markup_percentage DECIMAL(5,2) DEFAULT 15.00, -- Default profit margin
  include_shipping BOOLEAN DEFAULT true,
  include_handling BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_document_cache_url ON document_processing_cache(document_url);
CREATE INDEX idx_document_cache_expires ON document_processing_cache(expires_at);
CREATE INDEX idx_product_catalog_normalized ON product_catalog(normalized_name);
CREATE INDEX idx_product_catalog_manufacturer ON product_catalog(manufacturer);
CREATE INDEX idx_supplier_pricing_sku ON supplier_pricing(supplier_sku);
CREATE INDEX idx_supplier_pricing_product ON supplier_pricing(product_catalog_id);
CREATE INDEX idx_ocr_queue_status ON ocr_processing_queue(status, scheduled_for);
CREATE INDEX idx_api_costs_service ON api_usage_costs(service_name, created_at);

-- Full text search indexes
CREATE INDEX idx_product_catalog_search ON product_catalog USING gin(to_tsvector('english', product_name || ' ' || COALESCE(manufacturer, '')));
CREATE INDEX idx_supplier_pricing_search ON supplier_pricing USING gin(to_tsvector('english', product_name));

-- Triggers
CREATE TRIGGER update_product_catalog_updated_at
  BEFORE UPDATE ON product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bid_templates_updated_at
  BEFORE UPDATE ON bid_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE document_processing_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_templates ENABLE ROW LEVEL SECURITY;

-- Cache is read-only for all authenticated users
CREATE POLICY "All users can view document cache"
  ON document_processing_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Product catalog is viewable by all
CREATE POLICY "All users can view product catalog"
  ON product_catalog FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Supplier pricing is viewable by all authenticated users
CREATE POLICY "All users can view supplier pricing"
  ON supplier_pricing FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Companies can manage their own processing queue
CREATE POLICY "Companies manage their OCR queue"
  ON ocr_processing_queue FOR ALL
  USING (opportunity_id IN (
    SELECT o.id FROM opportunities o
    JOIN saved_opportunities so ON so.opportunity_id = o.id
    JOIN profiles p ON p.id = so.user_id
    WHERE p.id = auth.uid()
  ));

-- Companies can view their own API costs
CREATE POLICY "Companies view their API costs"
  ON api_usage_costs FOR SELECT
  USING (
    entity_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    ) OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Companies manage their own bid templates
CREATE POLICY "Companies manage bid templates"
  ON bid_templates FOR ALL
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Sample data for cost tracking
INSERT INTO api_usage_costs (service_name, operation_type, cost_usd) VALUES
  ('mistral_ocr', 'reference_cost_per_page', 0.01), -- $0.01 per page
  ('claude_ai', 'reference_cost_per_1k_tokens', 0.003), -- $3 per million input tokens
  ('sam_gov', 'reference_cost_per_request', 0.00); -- Free API