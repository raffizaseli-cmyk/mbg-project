-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Recipe Components (BOM Templates)
-- Tabel recipe_components dan recipe_component_items
-- Tambah kolom component_id di recipes
-- ═══════════════════════════════════════════════════════════════════════════

-- Tabel komponen (resep mini reusable)
CREATE TABLE IF NOT EXISTS recipe_components (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Bahan per komponen
CREATE TABLE IF NOT EXISTS recipe_component_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  component_id  UUID REFERENCES recipe_components(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES products(id),
  qty_needed    DECIMAL(15,3) NOT NULL,
  unit          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(component_id, ingredient_id)
);

-- Tambah kolom di recipes untuk referensi komponen
-- (nullable: recipe item bisa bahan langsung ATAU komponen)
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS component_id UUID REFERENCES recipe_components(id);

-- ═══ RLS ═══
ALTER TABLE recipe_components ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recipe_components' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON recipe_components
      FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Bypass RLS for service_role (backend API key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recipe_components' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON recipe_components
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE recipe_component_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recipe_component_items' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON recipe_component_items
      FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recipe_component_items' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON recipe_component_items
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
