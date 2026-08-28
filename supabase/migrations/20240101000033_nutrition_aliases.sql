-- Tabel untuk menyimpan hasil terjemahan bahasa lapangan/slang ke nama resmi TKPI
-- Memitigasi API request Gemini berulang untuk item yang sama

CREATE TABLE IF NOT EXISTS nutrition_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slang_name VARCHAR(255) NOT NULL,
    nutrition_ref_id UUID NOT NULL REFERENCES nutrition_ref(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    
    CONSTRAINT nutrition_aliases_slang_name_key UNIQUE (slang_name)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_aliases_slang_name ON nutrition_aliases(slang_name);
