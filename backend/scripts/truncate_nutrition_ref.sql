-- ============================================================================
-- TRUNCATE nutrition_ref table
-- ============================================================================
-- Jalankan ini di Supabase SQL Editor untuk clear nutrition_ref table
-- Sebelum menjalankan scrape_tkpi.py

TRUNCATE TABLE nutrition_ref CASCADE;

-- Verify
SELECT COUNT(*) as total_rows FROM nutrition_ref;
