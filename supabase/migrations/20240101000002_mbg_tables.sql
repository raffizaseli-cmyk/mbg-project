-- 002_mbg_tables.sql
-- MBG-specific tables: weekly menus, deliveries, budget allocations

CREATE TABLE IF NOT EXISTS mbg_weekly_menus (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,             -- Senin awal minggu
  day_of_week     INTEGER NOT NULL,          -- 1=Senin ... 6=Sabtu
  menu_id         UUID REFERENCES products(id),
  menu_name       TEXT NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, week_start, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_mbg_weekly_menus_tenant_id ON mbg_weekly_menus(tenant_id);

CREATE TABLE IF NOT EXISTS mbg_deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE,
  school_id             UUID REFERENCES schools(id),
  transaction_id        UUID REFERENCES transactions(id),
  menu_id               UUID REFERENCES products(id),
  menu_name             TEXT NOT NULL,
  delivery_date         DATE NOT NULL,
  sent_time             TIME,
  arrival_time          TIME,
  portions_sent         INTEGER NOT NULL,
  portions_received     INTEGER,
  food_condition        TEXT DEFAULT 'layak',
  packaging_condition   TEXT DEFAULT 'baik',
  packaging_type        TEXT DEFAULT 'wadah_reusable',
  sample_taken          BOOLEAN DEFAULT true,
  receiver_name         TEXT,
  recipient_signature_url TEXT,
  photo_proof_url       TEXT,
  status                TEXT DEFAULT 'pending',
  notes                 TEXT,
  is_locked             BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, school_id, delivery_date)
);
CREATE INDEX IF NOT EXISTS idx_mbg_deliveries_tenant_id ON mbg_deliveries(tenant_id);

CREATE TABLE IF NOT EXISTS mbg_budget_allocations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  total_portions      INTEGER NOT NULL,
  price_per_portion   DECIMAL(15,2) NOT NULL,
  total_revenue       DECIMAL(15,2) NOT NULL,
  pph22_deduction     DECIMAL(15,2) DEFAULT 0,
  net_revenue         DECIMAL(15,2),
  budget_bahan        DECIMAL(15,2),
  budget_ops          DECIMAL(15,2),
  budget_insentif     DECIMAL(15,2),
  actual_bahan_cost   DECIMAL(15,2) DEFAULT 0,
  actual_ops_cost     DECIMAL(15,2) DEFAULT 0,
  actual_insentif_cost DECIMAL(15,2) DEFAULT 0,
  net_profit          DECIMAL(15,2),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);
CREATE INDEX IF NOT EXISTS idx_mbg_budget_allocations_tenant_id ON mbg_budget_allocations(tenant_id);


