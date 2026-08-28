-- 004_excel_files.sql
-- Tracking generated Excel files per tenant per month

CREATE TABLE IF NOT EXISTS excel_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL,
  file_url        TEXT NOT NULL,
  last_updated    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_excel_files_tenant_id ON excel_files(tenant_id);


