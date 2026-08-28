-- Migration: Create ingredient_unit_chains table for Hierarchical Unit Conversion Chains
CREATE TABLE IF NOT EXISTS ingredient_unit_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES master_ingredients(id) ON DELETE CASCADE,
    from_qty NUMERIC(12, 4) NOT NULL DEFAULT 1.0,
    from_unit VARCHAR(50) NOT NULL,
    to_qty NUMERIC(12, 4) NOT NULL DEFAULT 1.0,
    to_unit VARCHAR(50) NOT NULL,
    multiplier NUMERIC(14, 6) GENERATED ALWAYS AS (to_qty / NULLIF(from_qty, 0)) STORED,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_ingredient_chain UNIQUE (ingredient_id, from_unit, to_unit)
);

CREATE INDEX IF NOT EXISTS idx_ingredient_unit_chains_ing ON ingredient_unit_chains(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_unit_chains_units ON ingredient_unit_chains(ingredient_id, from_unit, to_unit);
