-- Contract Family Tracking for Amendment Relationships
-- Enables tracking of base contracts and their amendments/modifications

-- Create contract families table
CREATE TABLE IF NOT EXISTS contract_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_solicitation_number VARCHAR(100) NOT NULL,
    family_name VARCHAR(255),
    agency VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    CONSTRAINT unique_base_solicitation UNIQUE (base_solicitation_number)
);

-- Add family tracking to opportunities table
ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS contract_family_id UUID REFERENCES contract_families(id),
ADD COLUMN IF NOT EXISTS is_amendment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS amendment_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS base_solicitation_number VARCHAR(100);

-- Add family tracking to community extractions
ALTER TABLE community_extractions
ADD COLUMN IF NOT EXISTS contract_family_id UUID REFERENCES contract_families(id),
ADD COLUMN IF NOT EXISTS base_solicitation_number VARCHAR(100);

-- Create contract relationships table for tracking amendment history
CREATE TABLE IF NOT EXISTS contract_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_family_id UUID NOT NULL REFERENCES contract_families(id) ON DELETE CASCADE,
    parent_opportunity_id UUID REFERENCES opportunities(id),
    child_opportunity_id UUID REFERENCES opportunities(id),
    relationship_type VARCHAR(50) NOT NULL, -- 'amendment', 'modification', 'extension', 'recompete'
    sequence_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure no duplicate relationships
    CONSTRAINT unique_parent_child UNIQUE (parent_opportunity_id, child_opportunity_id)
);

-- Create indexes for performance
CREATE INDEX idx_opportunities_contract_family ON opportunities(contract_family_id);
CREATE INDEX idx_opportunities_base_solicitation ON opportunities(base_solicitation_number);
CREATE INDEX idx_opportunities_is_amendment ON opportunities(is_amendment);
CREATE INDEX idx_community_extractions_family ON community_extractions(contract_family_id);
CREATE INDEX idx_contract_relationships_family ON contract_relationships(contract_family_id);

-- Function to extract base solicitation number from full solicitation
CREATE OR REPLACE FUNCTION extract_base_solicitation_number(full_solicitation VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    base_number VARCHAR;
BEGIN
    -- Remove common amendment patterns
    -- Examples: FA8773-21-R-0001-A001 -> FA8773-21-R-0001
    --          W912DY-20-R-0026-M002 -> W912DY-20-R-0026
    base_number := regexp_replace(full_solicitation, '-[AM]\d+$', '', 'i');
    
    -- Remove other amendment indicators
    base_number := regexp_replace(base_number, '[-_](MOD|AMD|AMEND)\d*$', '', 'i');
    
    RETURN base_number;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to detect if a solicitation is an amendment
CREATE OR REPLACE FUNCTION is_solicitation_amendment(solicitation_number VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check for common amendment patterns
    RETURN solicitation_number ~* '[-_][AM]\d+$' OR 
           solicitation_number ~* '[-_](MOD|AMD|AMEND)\d*$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find or create contract family
CREATE OR REPLACE FUNCTION find_or_create_contract_family(
    p_solicitation_number VARCHAR,
    p_agency VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_base_number VARCHAR;
    v_family_id UUID;
BEGIN
    -- Extract base solicitation number
    v_base_number := extract_base_solicitation_number(p_solicitation_number);
    
    -- Try to find existing family
    SELECT id INTO v_family_id
    FROM contract_families
    WHERE base_solicitation_number = v_base_number;
    
    -- Create new family if not found
    IF v_family_id IS NULL THEN
        INSERT INTO contract_families (base_solicitation_number, agency)
        VALUES (v_base_number, p_agency)
        RETURNING id INTO v_family_id;
    END IF;
    
    RETURN v_family_id;
END;
$$ LANGUAGE plpgsql;

-- Function to link opportunities to contract families
CREATE OR REPLACE FUNCTION link_opportunity_to_family(
    p_opportunity_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_opportunity RECORD;
    v_family_id UUID;
    v_is_amendment BOOLEAN;
    v_base_number VARCHAR;
BEGIN
    -- Get opportunity details
    SELECT solicitation_number, agency 
    INTO v_opportunity
    FROM opportunities
    WHERE id = p_opportunity_id;
    
    IF v_opportunity IS NULL THEN
        RETURN;
    END IF;
    
    -- Detect if amendment
    v_is_amendment := is_solicitation_amendment(v_opportunity.solicitation_number);
    v_base_number := extract_base_solicitation_number(v_opportunity.solicitation_number);
    
    -- Find or create family
    v_family_id := find_or_create_contract_family(
        v_opportunity.solicitation_number,
        v_opportunity.agency
    );
    
    -- Update opportunity
    UPDATE opportunities
    SET 
        contract_family_id = v_family_id,
        is_amendment = v_is_amendment,
        base_solicitation_number = v_base_number,
        amendment_number = CASE 
            WHEN v_is_amendment THEN 
                regexp_replace(solicitation_number, '^.*[-_]([AM]\d+)$', '\1', 'i')
            ELSE NULL
        END
    WHERE id = p_opportunity_id;
    
    -- Create relationship if amendment
    IF v_is_amendment THEN
        -- Find parent (base contract or previous amendment)
        INSERT INTO contract_relationships (
            contract_family_id,
            parent_opportunity_id,
            child_opportunity_id,
            relationship_type
        )
        SELECT 
            v_family_id,
            o.id,
            p_opportunity_id,
            'amendment'
        FROM opportunities o
        WHERE o.contract_family_id = v_family_id
          AND o.id != p_opportunity_id
          AND (o.is_amendment = FALSE OR 
               o.amendment_number < (
                   SELECT amendment_number 
                   FROM opportunities 
                   WHERE id = p_opportunity_id
               ))
        ORDER BY o.is_amendment, o.amendment_number DESC NULLS LAST
        LIMIT 1
        ON CONFLICT (parent_opportunity_id, child_opportunity_id) 
        DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- View to get contract family trees
CREATE OR REPLACE VIEW contract_family_tree AS
WITH RECURSIVE family_tree AS (
    -- Base contracts (roots)
    SELECT 
        o.id,
        o.solicitation_number,
        o.title,
        o.agency,
        o.posted_date,
        o.response_deadline,
        o.contract_family_id,
        o.is_amendment,
        o.amendment_number,
        0 as level,
        ARRAY[o.id] as path,
        o.id as root_id
    FROM opportunities o
    WHERE o.is_amendment = FALSE
      AND o.contract_family_id IS NOT NULL
    
    UNION ALL
    
    -- Amendments (branches)
    SELECT 
        o.id,
        o.solicitation_number,
        o.title,
        o.agency,
        o.posted_date,
        o.response_deadline,
        o.contract_family_id,
        o.is_amendment,
        o.amendment_number,
        ft.level + 1,
        ft.path || o.id,
        ft.root_id
    FROM opportunities o
    JOIN contract_relationships cr ON o.id = cr.child_opportunity_id
    JOIN family_tree ft ON cr.parent_opportunity_id = ft.id
    WHERE NOT o.id = ANY(ft.path) -- Prevent cycles
)
SELECT * FROM family_tree
ORDER BY contract_family_id, level, amendment_number;

-- Function to get complete contract family history
CREATE OR REPLACE FUNCTION get_contract_family_history(
    p_opportunity_id UUID
)
RETURNS TABLE (
    opportunity_id UUID,
    solicitation_number VARCHAR,
    title TEXT,
    posted_date DATE,
    response_deadline TIMESTAMP,
    is_amendment BOOLEAN,
    amendment_number VARCHAR,
    relationship_type VARCHAR,
    level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH family AS (
        SELECT contract_family_id
        FROM opportunities
        WHERE id = p_opportunity_id
    )
    SELECT 
        ft.id as opportunity_id,
        ft.solicitation_number,
        ft.title,
        ft.posted_date,
        ft.response_deadline,
        ft.is_amendment,
        ft.amendment_number,
        cr.relationship_type,
        ft.level
    FROM contract_family_tree ft
    LEFT JOIN contract_relationships cr 
        ON ft.id = cr.child_opportunity_id
    WHERE ft.contract_family_id = (SELECT contract_family_id FROM family)
    ORDER BY ft.level, ft.amendment_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically link opportunities to families
CREATE OR REPLACE FUNCTION auto_link_opportunity_to_family()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if solicitation_number is set and family not already linked
    IF NEW.solicitation_number IS NOT NULL AND NEW.contract_family_id IS NULL THEN
        PERFORM link_opportunity_to_family(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opportunity_family_link_trigger
AFTER INSERT ON opportunities
FOR EACH ROW
EXECUTE FUNCTION auto_link_opportunity_to_family();

-- Migrate existing opportunities to contract families
DO $$
DECLARE
    opp RECORD;
    processed_count INTEGER := 0;
BEGIN
    FOR opp IN 
        SELECT id, solicitation_number 
        FROM opportunities 
        WHERE contract_family_id IS NULL 
          AND solicitation_number IS NOT NULL
        ORDER BY posted_date
    LOOP
        PERFORM link_opportunity_to_family(opp.id);
        processed_count := processed_count + 1;
        
        -- Log progress every 1000 records
        IF processed_count % 1000 = 0 THEN
            RAISE NOTICE 'Processed % opportunities', processed_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration complete. Processed % opportunities', processed_count;
END $$;

-- Grant permissions
GRANT SELECT ON contract_families TO authenticated;
GRANT SELECT ON contract_relationships TO authenticated;
GRANT SELECT ON contract_family_tree TO authenticated;
GRANT EXECUTE ON FUNCTION get_contract_family_history(UUID) TO authenticated;

-- Add RLS policies
ALTER TABLE contract_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_relationships ENABLE ROW LEVEL SECURITY;

-- Everyone can read contract families
CREATE POLICY "Contract families are viewable by all users"
ON contract_families FOR SELECT
TO authenticated
USING (true);

-- Everyone can read contract relationships
CREATE POLICY "Contract relationships are viewable by all users"
ON contract_relationships FOR SELECT
TO authenticated
USING (true);

-- Add comments
COMMENT ON TABLE contract_families IS 'Groups related contracts (base + amendments) into families';
COMMENT ON TABLE contract_relationships IS 'Tracks parent-child relationships between contracts';
COMMENT ON FUNCTION extract_base_solicitation_number IS 'Extracts base solicitation number by removing amendment suffixes';
COMMENT ON FUNCTION get_contract_family_history IS 'Returns complete amendment history for a contract family';