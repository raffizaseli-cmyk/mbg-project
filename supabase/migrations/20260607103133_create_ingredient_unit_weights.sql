-- Buat tabel suci referensi satuan master
CREATE TABLE IF NOT EXISTS ingredient_unit_weights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_id UUID NOT NULL REFERENCES master_ingredients(id) ON DELETE CASCADE,
    unit VARCHAR NOT NULL, -- Contoh: 'ikat', 'papan', 'karung', 'pcs'
    weight_gram NUMERIC NOT NULL, -- Berat bersih murni (contoh: 250, 1650)
    description TEXT,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- KUNCI MUTLAK: Mencegah duplikasi satuan per bahan baku
    CONSTRAINT unique_ingredient_unit UNIQUE (ingredient_id, unit)
);

-- Bikin index biar backend lu nyari data secepat kilat pas parsing nota
CREATE INDEX IF NOT EXISTS idx_ingredient_unit_search ON ingredient_unit_weights(ingredient_id, unit);
