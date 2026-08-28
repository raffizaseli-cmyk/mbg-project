-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Unit Conversion + BOM Overhead
-- Jalankan di Supabase SQL Editor SETELAH backup
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Tambah kolom konversi satuan di products ─────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS base_unit TEXT DEFAULT 'gram',
  ADD COLUMN IF NOT EXISTS display_unit TEXT DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(15,6) DEFAULT 1000;

-- ─── 2. Tambah kolom usage_type di recipes ───────────────────────────────────

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'per_porsi',
  ADD COLUMN IF NOT EXISTS daily_qty DECIMAL(15,3) DEFAULT 0;

-- ─── 3. Tambah kolom usage_type di recipe_component_items ────────────────────

ALTER TABLE recipe_component_items
  ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'per_porsi',
  ADD COLUMN IF NOT EXISTS daily_qty DECIMAL(15,3) DEFAULT 0;

-- ─── 4. Data migration: update existing products ─────────────────────────────

-- Bahan dengan unit kg → base gram, factor 1000
-- stock_qty dikonversi: 50 kg → 50000 gram
UPDATE products
SET base_unit = 'gram',
    display_unit = 'kg',
    conversion_factor = 1000,
    stock_qty = stock_qty * 1000
WHERE unit = 'kg' AND base_unit = 'gram' AND conversion_factor = 1000
  AND tenant_id IS NOT NULL;

-- Bahan dengan unit liter → base ml, factor 1000
UPDATE products
SET base_unit = 'ml',
    display_unit = 'liter',
    conversion_factor = 1000,
    stock_qty = stock_qty * 1000
WHERE unit = 'liter' AND base_unit = 'gram' AND conversion_factor = 1000
  AND tenant_id IS NOT NULL;

-- Bahan dengan unit gram → base gram, factor 1
UPDATE products
SET base_unit = 'gram',
    display_unit = 'gram',
    conversion_factor = 1
WHERE unit = 'gram' AND tenant_id IS NOT NULL;

-- Bahan dengan unit ml → base ml, factor 1
UPDATE products
SET base_unit = 'ml',
    display_unit = 'ml',
    conversion_factor = 1
WHERE unit = 'ml' AND tenant_id IS NOT NULL;

-- Bahan countable (pcs, ikat, bungkus, dll) → factor 1
UPDATE products
SET base_unit = 'pcs',
    display_unit = unit,
    conversion_factor = 1
WHERE unit IN ('pcs', 'ikat', 'bungkus', 'karung', 'tabung',
               'buah', 'pack', 'dus', 'botol')
  AND tenant_id IS NOT NULL;

-- ─── 5. Migrasi stock_history ────────────────────────────────────────────────
-- Update stock_history: konversi change_qty dan balance_after untuk kg/liter
UPDATE stock_history sh
SET change_qty = sh.change_qty * p.conversion_factor,
    balance_after = sh.balance_after * p.conversion_factor
FROM products p
WHERE sh.product_id = p.id
  AND p.conversion_factor > 1
  AND p.unit IN ('kg', 'liter');

-- ─── 6. Migrasi recipes qty_needed ke base unit ──────────────────────────────
-- Recipes yang punya ingredient_id dengan conversion_factor > 1
UPDATE recipes r
SET qty_needed = r.qty_needed * p.conversion_factor
FROM products p
WHERE r.ingredient_id = p.id
  AND p.conversion_factor > 1;

-- Recipe component items juga
UPDATE recipe_component_items rci
SET qty_needed = rci.qty_needed * p.conversion_factor
FROM products p
WHERE rci.ingredient_id = p.id
  AND p.conversion_factor > 1;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFIKASI: jalankan query ini setelah migration
-- ═══════════════════════════════════════════════════════════════════════════════
-- SELECT name, unit, display_unit, base_unit, conversion_factor, stock_qty
-- FROM products
-- WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
-- ORDER BY name;
