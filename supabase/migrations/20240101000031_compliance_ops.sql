-- ============================================================
-- Modul 21.5b: Compliance Operasional Schema
-- Tables: hygiene_checks, temperature_logs, food_samples,
--         food_waste_reports, incident_reports, slhs_documents,
--         compliance_counters, alerts
-- ALTER: mbg_deliveries + BAST fields
-- 
-- Jalankan manual di Supabase SQL Editor
-- ============================================================

-- ─── 1. Compliance Counters (Auto-Increment per Tenant) ─────────────────────

CREATE TABLE IF NOT EXISTS compliance_counters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  counter_type  TEXT NOT NULL,
  -- Types: 'sample_code', 'bast_number', 'incident_code'
  last_value    INTEGER NOT NULL DEFAULT 0,
  reset_period  TEXT DEFAULT 'daily',
  -- 'daily' = reset tiap hari, 'monthly' = reset tiap bulan, 'yearly' = reset tiap tahun
  last_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, counter_type)
);

ALTER TABLE compliance_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_compliance_counters" ON compliance_counters;
CREATE POLICY "tenant_iso_compliance_counters" ON compliance_counters FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));


-- ─── 2. Alerts Table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  alert_type    TEXT NOT NULL,
  -- Types: 'temperature_abnormal', 'sample_expiring', 'slhs_expiring',
  --        'incident_reported', 'hygiene_issue'
  severity      TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  
  title         TEXT NOT NULL,
  message       TEXT,
  
  source_table  TEXT,       -- e.g. 'temperature_logs', 'food_samples'
  source_id     UUID,       -- FK to the source record

  is_read       BOOLEAN DEFAULT FALSE,
  is_resolved   BOOLEAN DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES users(id) ON DELETE SET NULL,

  telegram_sent BOOLEAN DEFAULT FALSE,
  telegram_sent_at TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_unread
  ON alerts(tenant_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_source
  ON alerts(source_table, source_id);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_alerts" ON alerts;
CREATE POLICY "tenant_iso_alerts" ON alerts FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));


-- ─── 3. Hygiene Checks ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hygiene_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  check_date      DATE NOT NULL,
  checked_by      UUID REFERENCES users(id) ON DELETE SET NULL,

  items           JSONB NOT NULL,
  -- Format: [{area: str, status: str, catatan: str, suhu?: float}, ...]
  -- Status: "baik" | "perlu_perbaikan"

  overall_status  TEXT DEFAULT 'baik'
    CHECK (overall_status IN ('baik', 'perlu_perbaikan', 'tidak_layak')),

  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, check_date)
);

CREATE INDEX IF NOT EXISTS idx_hygiene_date
  ON hygiene_checks(tenant_id, check_date DESC);

ALTER TABLE hygiene_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_hygiene" ON hygiene_checks;
CREATE POLICY "tenant_iso_hygiene" ON hygiene_checks FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));


-- ─── 4. Temperature Logs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS temperature_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  log_date        DATE NOT NULL,
  log_time        TIME NOT NULL,
  area            TEXT NOT NULL
    CHECK (area IN ('gudang_kering', 'chiller', 'freezer')),

  temperature     DECIMAL(5, 2) NOT NULL,
  is_normal       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Threshold: gudang_kering < 25, chiller 0-5, freezer < -18

  notes           TEXT,
  recorded_by     UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temp_date_area
  ON temperature_logs(tenant_id, log_date DESC, area);

ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_temp" ON temperature_logs;
CREATE POLICY "tenant_iso_temp" ON temperature_logs FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));


-- ─── 5. Food Samples ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS food_samples (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  sample_date     DATE NOT NULL,
  sample_code     TEXT NOT NULL,

  menu_name       TEXT NOT NULL,
  taken_at        TIME NOT NULL,
  weight_gram     DECIMAL(8, 2) DEFAULT 50,
  storage_temp    DECIMAL(5, 2),

  expires_at      TIMESTAMPTZ,
  status          TEXT DEFAULT 'disimpan'
    CHECK (status IN ('disimpan', 'bisa_dibuang', 'dibuang', 'diamankan_investigasi')),

  disposed_at     TIMESTAMPTZ,
  is_alert_sent   BOOLEAN DEFAULT FALSE,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, sample_code)
);

CREATE INDEX IF NOT EXISTS idx_sample_date
  ON food_samples(tenant_id, sample_date DESC);
CREATE INDEX IF NOT EXISTS idx_sample_expires
  ON food_samples(tenant_id, expires_at, status);

ALTER TABLE food_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_samples" ON food_samples;
CREATE POLICY "tenant_iso_samples" ON food_samples FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));


-- ─── 6. Food Waste Reports ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS food_waste_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  delivery_id       UUID REFERENCES mbg_deliveries(id) ON DELETE CASCADE,
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  report_date       DATE NOT NULL,
  portions_sent     INTEGER NOT NULL CHECK (portions_sent > 0),
  portions_consumed INTEGER CHECK (portions_consumed >= 0),

  waste_pct         DECIMAL(5, 2),
  comstock_score    INTEGER CHECK (comstock_score BETWEEN 1 AND 5),

  waste_reason      TEXT,
  notes             TEXT,

  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, delivery_id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_waste_date
  ON food_waste_reports(tenant_id, report_date DESC);

ALTER TABLE food_waste_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_waste" ON food_waste_reports;
CREATE POLICY "tenant_iso_waste" ON food_waste_reports FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));


-- ─── 7. Incident Reports ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incident_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  incident_code       TEXT NOT NULL,

  school_id           UUID REFERENCES schools(id) ON DELETE SET NULL,
  incident_time       TIMESTAMPTZ NOT NULL,
  location            TEXT NOT NULL,

  victim_count        INTEGER NOT NULL CHECK (victim_count > 0),
  symptoms            TEXT[],
  first_action        TEXT NOT NULL,

  sample_secured      BOOLEAN DEFAULT FALSE,
  sample_ids          TEXT[],
  reported_to         TEXT[],

  status              TEXT DEFAULT 'investigasi'
    CHECK (status IN ('investigasi', 'selesai', 'ditutup')),
  investigation_result TEXT,

  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, incident_code)
);

CREATE INDEX IF NOT EXISTS idx_incident_date
  ON incident_reports(tenant_id, incident_time DESC);

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_incident" ON incident_reports;
CREATE POLICY "tenant_iso_incident" ON incident_reports FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));


-- ─── 8. SLHS Documents ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS slhs_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  cert_number     TEXT NOT NULL,
  issued_date     DATE NOT NULL,
  expires_date    DATE NOT NULL,
  label_expires   DATE,

  file_url        TEXT,

  status          TEXT DEFAULT 'aktif'
    CHECK (status IN ('aktif', 'expiring_soon', 'expired', 'dalam_proses')),

  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, cert_number)
);

CREATE INDEX IF NOT EXISTS idx_slhs_status
  ON slhs_documents(tenant_id, status);

ALTER TABLE slhs_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_slhs" ON slhs_documents;
CREATE POLICY "tenant_iso_slhs" ON slhs_documents FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));


-- ─── 9. ALTER mbg_deliveries — BAST Extensions ─────────────────────────────

ALTER TABLE mbg_deliveries
  ADD COLUMN IF NOT EXISTS bast_number TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_number TEXT,
  ADD COLUMN IF NOT EXISTS cooked_at TIME,
  ADD COLUMN IF NOT EXISTS departed_at TIME,
  ADD COLUMN IF NOT EXISTS arrived_at TIME,
  ADD COLUMN IF NOT EXISTS food_temp_arrival DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS seal_condition TEXT DEFAULT 'utuh',
  ADD COLUMN IF NOT EXISTS tray_sent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tray_returned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portions_received INTEGER,
  ADD COLUMN IF NOT EXISTS damaged_portions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receiver_signature_name TEXT,
  ADD COLUMN IF NOT EXISTS hours_since_cooking DECIMAL(4, 2);

-- Add CHECK constraint for seal_condition (separate statement for IF NOT EXISTS compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_seal_condition'
  ) THEN
    ALTER TABLE mbg_deliveries
      ADD CONSTRAINT chk_seal_condition
      CHECK (seal_condition IN ('utuh', 'terbuka', 'rusak'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bast_number
  ON mbg_deliveries(bast_number);
CREATE INDEX IF NOT EXISTS idx_delivery_bast_fields
  ON mbg_deliveries(tenant_id, delivery_date DESC, bast_number);


-- ─── 10. Auto-set is_normal trigger for temperature_logs ────────────────────

CREATE OR REPLACE FUNCTION fn_auto_set_temp_normal()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.area
    WHEN 'gudang_kering' THEN
      NEW.is_normal := NEW.temperature < 25;
    WHEN 'chiller' THEN
      NEW.is_normal := NEW.temperature BETWEEN 0 AND 5;
    WHEN 'freezer' THEN
      NEW.is_normal := NEW.temperature < -18;
    ELSE
      NEW.is_normal := TRUE;
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_temp_normal ON temperature_logs;
CREATE TRIGGER trg_auto_temp_normal
  BEFORE INSERT OR UPDATE OF temperature, area
  ON temperature_logs
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_set_temp_normal();


-- ─── 11. Auto-set expires_at for food_samples ──────────────────────────────

CREATE OR REPLACE FUNCTION fn_auto_set_sample_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := (NEW.sample_date + NEW.taken_at) + INTERVAL '48 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_sample_expiry ON food_samples;
CREATE TRIGGER trg_auto_sample_expiry
  BEFORE INSERT ON food_samples
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_set_sample_expiry();


-- ─── 12. Auto-calc waste_pct for food_waste_reports ─────────────────────────

CREATE OR REPLACE FUNCTION fn_auto_calc_waste_pct()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.portions_sent > 0 AND NEW.portions_consumed IS NOT NULL THEN
    NEW.waste_pct := ROUND(
      ((NEW.portions_sent - NEW.portions_consumed)::DECIMAL / NEW.portions_sent) * 100, 2
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_waste_pct ON food_waste_reports;
CREATE TRIGGER trg_auto_waste_pct
  BEFORE INSERT OR UPDATE OF portions_sent, portions_consumed
  ON food_waste_reports
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_calc_waste_pct();


-- ============================================================
-- ✅ Migration complete
-- Run validation queries:
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--     AND tablename IN ('hygiene_checks', 'temperature_logs', 'food_samples',
--       'food_waste_reports', 'incident_reports', 'slhs_documents',
--       'compliance_counters', 'alerts');
-- ============================================================
