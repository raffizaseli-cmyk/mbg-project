-- ============================================================================
-- MIGRATION: Upgrade nutrition_ref table untuk support TKPI data lengkap
-- ============================================================================
-- File: migration_nutrition_ref_v2.sql
-- Purpose: Add custom_nutrients (JSONB), data_source, dan UNIQUE constraint
-- Status: Safe to run (NULLABLE fields, backward compatible)
-- ============================================================================

-- Step 1: Add new columns (jika belum ada)
ALTER TABLE nutrition_ref
ADD COLUMN IF NOT EXISTS data_source VARCHAR(100) DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS custom_nutrients JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Step 2: Create case-insensitive unique index on name
-- Ini mencegah duplikasi saat scraping dijalankan berkali-kali
-- Existing data yang duplikat akan tetap OK, tapi insert baru akan rejected
CREATE UNIQUE INDEX IF NOT EXISTS unique_nutrition_ref_name
ON nutrition_ref (LOWER(name));

-- Step 3: Create trigram index untuk fuzzy search (perlu extension pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_nutrition_ref_name_trgm 
ON nutrition_ref USING GIN (name gin_trgm_ops);

-- Step 4: Update schema comment
COMMENT ON TABLE nutrition_ref IS 
'Master nutrition reference data (TKPI) - Global nutrition database for all meals';

COMMENT ON COLUMN nutrition_ref.name IS 
'Official food name (TKPI standard name or product name)';

COMMENT ON COLUMN nutrition_ref.calories IS 
'Energy content in kcal per 100g';

COMMENT ON COLUMN nutrition_ref.proteins IS 
'Protein content in grams per 100g';

COMMENT ON COLUMN nutrition_ref.fat IS 
'Total fat content in grams per 100g';

COMMENT ON COLUMN nutrition_ref.carbohydrate IS 
'Carbohydrate content in grams per 100g';

COMMENT ON COLUMN nutrition_ref.fiber IS 
'Dietary fiber content in grams per 100g';

COMMENT ON COLUMN nutrition_ref.sodium IS 
'Sodium content in milligrams per 100g';

COMMENT ON COLUMN nutrition_ref.potassium IS 
'Potassium content in milligrams per 100g';

COMMENT ON COLUMN nutrition_ref.kategori IS 
'Food category (e.g., sereal, sayur, buah, daging, minyak, etc.)';

COMMENT ON COLUMN nutrition_ref.data_source IS 
'Data source tracking (TKPI_2024, MANUAL, GEMINI_AI, etc.)';

COMMENT ON COLUMN nutrition_ref.custom_nutrients IS 
'Additional micronutrients in JSONB format: id_bahan, kondisi, air_g, kalsium_mg, vitamin_c_mg, etc.';

COMMENT ON COLUMN nutrition_ref.updated_at IS 
'Timestamp when record was last updated or created from scraping';

-- Step 5: Create RPC untuk fuzzy search nutrisi (dipakai oleh nutrition_service.py)
-- Simplified version: return hanya columns yang pasti ada di table
DROP FUNCTION IF EXISTS match_nutrition_trgm(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION match_nutrition_trgm(search_text TEXT)
RETURNS TABLE (
  name TEXT,
  calories NUMERIC,
  proteins NUMERIC,
  fat NUMERIC,
  carbohydrate NUMERIC,
  kategori TEXT,
  sim_score REAL
) AS $$
SELECT 
  nr.name,
  nr.calories,
  nr.proteins,
  nr.fat,
  nr.carbohydrate,
  nr.kategori,
  similarity(nr.name, search_text)
FROM nutrition_ref nr
WHERE nr.name % search_text
ORDER BY similarity(nr.name, search_text) DESC
LIMIT 5;
$$ LANGUAGE SQL STABLE ROWS 5;

GRANT EXECUTE ON FUNCTION match_nutrition_trgm TO authenticated, anon;

COMMENT ON FUNCTION match_nutrition_trgm IS 'Fuzzy search nutrisi menggunakan trigram. Dipanggil oleh nutrition_service.map_and_link_product()';

-- Step 5a: Create view untuk akses mudah data lengkap
CREATE OR REPLACE VIEW nutrition_ref_with_summary AS
SELECT 
  id,
  name,
  calories,
  proteins,
  fat,
  carbohydrate,
  fiber,
  sodium,
  potassium,
  kategori,
  data_source,
  (custom_nutrients->>'id_bahan') as id_bahan,
  (custom_nutrients->>'kondisi') as kondisi,
  (custom_nutrients->'bdd_persen')::float as bdd_persen,
  (custom_nutrients->'air_g')::float as air_g,
  (custom_nutrients->'abu_g')::float as abu_g,
  (custom_nutrients->'kalsium_mg')::float as kalsium_mg,
  (custom_nutrients->'fosfor_mg')::float as fosfor_mg,
  (custom_nutrients->'besi_mg')::float as besi_mg,
  (custom_nutrients->'tembaga_mg')::float as tembaga_mg,
  (custom_nutrients->'seng_mg')::float as seng_mg,
  (custom_nutrients->'retinol_mcg')::float as retinol_mcg,
  (custom_nutrients->'b_karoten_mcg')::float as b_karoten_mcg,
  (custom_nutrients->'karoten_total_mcg')::float as karoten_total_mcg,
  (custom_nutrients->'thiamin_mg')::float as thiamin_mg,
  (custom_nutrients->'riboflavin_mg')::float as riboflavin_mg,
  (custom_nutrients->'niasin_mg')::float as niasin_mg,
  (custom_nutrients->'vitamin_c_mg')::float as vitamin_c_mg,
  updated_at
FROM nutrition_ref;

-- Step 6: Verify migration
SELECT 
  'nutrition_ref' as table_name,
  COUNT(*) as total_entries,
  COUNT(CASE WHEN custom_nutrients IS NOT NULL THEN 1 END) as with_custom_nutrients,
  COUNT(CASE WHEN data_source = 'MANUAL' THEN 1 END) as manual_entries,
  MAX(updated_at) as last_updated
FROM nutrition_ref;

-- ============================================================================
-- ROLLBACK (jika ada masalah):
-- ============================================================================
-- ALTER TABLE nutrition_ref DROP COLUMN IF EXISTS custom_nutrients;
-- ALTER TABLE nutrition_ref DROP COLUMN IF EXISTS data_source;
-- ALTER TABLE nutrition_ref DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE nutrition_ref DROP CONSTRAINT IF EXISTS unique_nutrition_ref_name;
-- DROP INDEX IF EXISTS idx_nutrition_ref_name_trgm;
-- DROP VIEW IF EXISTS nutrition_ref_with_summary;
