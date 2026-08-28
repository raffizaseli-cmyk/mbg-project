-- Migration: Create ingredient_mapping table for AI-driven TKPI mapping
-- This table stores mappings between nutrition_ref entries and product/nota keywords.

CREATE TABLE IF NOT EXISTS ingredient_mapping (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nutrition_ref_id INTEGER NOT NULL REFERENCES nutrition_ref(id) ON DELETE CASCADE,
    nama_tkpi TEXT NOT NULL,
    nama_bersih TEXT,
    kondisi TEXT,
    kategori_induk TEXT,
    keyword_nota TEXT[],
    konversi_satuan JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_ingredient_mapping_ref UNIQUE (nutrition_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_ingredient_mapping_ref ON ingredient_mapping(nutrition_ref_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_mapping_kategori ON ingredient_mapping(kategori_induk);
CREATE INDEX IF NOT EXISTS idx_ingredient_mapping_keyword ON ingredient_mapping USING GIN (keyword_nota);
CREATE INDEX IF NOT EXISTS idx_ingredient_mapping_conversion ON ingredient_mapping USING GIN (konversi_satuan);
