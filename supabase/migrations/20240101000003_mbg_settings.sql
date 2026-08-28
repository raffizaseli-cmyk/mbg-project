-- 003_mbg_settings.sql
-- MBG allocation settings per tenant

CREATE TABLE IF NOT EXISTS mbg_allocation_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
  bahan_sd_smp        DECIMAL(15,2) DEFAULT 10000,
  bahan_paud_tk       DECIMAL(15,2) DEFAULT 8000,
  ops_per_porsi       DECIMAL(15,2) DEFAULT 3000,
  insentif_harian     DECIMAL(15,2) DEFAULT 6000000,
  hari_kerja_bulan    INTEGER DEFAULT 26,
  effective_date      DATE DEFAULT CURRENT_DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mbg_allocation_settings_tenant_id ON mbg_allocation_settings(tenant_id);


