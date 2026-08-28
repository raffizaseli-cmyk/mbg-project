-- backend/supabase/migrations/20240101000019_hr_payroll.sql

-- Jabatan + base salary
CREATE TABLE job_positions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL, -- "Juru Masak", "Driver", "Packing", "Admin"
  salary_type   TEXT DEFAULT 'harian', -- harian / mingguan / bulanan
  base_salary   DECIMAL(15,2) NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Relawan/karyawan
CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  nik             TEXT,
  phone           TEXT,
  address         TEXT,
  position_id     UUID REFERENCES job_positions(id),
  employee_type   TEXT DEFAULT 'relawan', -- relawan / karyawan_tetap / kader / guru
  bank_name       TEXT,
  bank_account    TEXT,
  bank_holder     TEXT,
  join_date       DATE DEFAULT CURRENT_DATE,
  is_active       BOOLEAN DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Absensi berbasis pengecualian
-- HANYA catat yang TIDAK HADIR
-- Default semua hadir
CREATE TABLE attendances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id   UUID REFERENCES employees(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  status        TEXT NOT NULL, -- alpa / sakit / izin
  notes         TEXT,
  recorded_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, employee_id, date)
);

-- Periode penggajian
CREATE TABLE payroll_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  working_days  INTEGER NOT NULL,
  status        TEXT DEFAULT 'draft', -- draft / approved / paid
  total_amount  DECIMAL(15,2) DEFAULT 0,
  paid_date     DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Detail gaji per karyawan per periode
CREATE TABLE payroll_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  period_id       UUID REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id     UUID REFERENCES employees(id),
  position_name   TEXT NOT NULL, -- snapshot jabatan saat periode dibuat
  base_salary     DECIMAL(15,2) NOT NULL, -- snapshot gaji saat periode dibuat
  working_days    INTEGER NOT NULL,
  absent_days     INTEGER DEFAULT 0,
  present_days    INTEGER, -- working_days - absent_days
  gross_amount    DECIMAL(15,2), -- present_days × base_salary
  deductions      DECIMAL(15,2) DEFAULT 0,
  net_amount      DECIMAL(15,2), -- gross - deductions
  transaction_id  UUID REFERENCES transactions(id), -- diisi saat status = paid
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Biaya operasional
CREATE TABLE operational_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL, -- "Listrik", "Gas LPG", "BBM", "Sewa"
  category        TEXT DEFAULT 'operasional',
  amount          DECIMAL(15,2) NOT NULL,
  cost_date       DATE NOT NULL,
  is_recurring    BOOLEAN DEFAULT false,
  recurring_day   INTEGER, -- tanggal berapa tiap bulan (1-31)
  notes           TEXT,
  transaction_id  UUID REFERENCES transactions(id), -- link ke transactions table
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS semua tabel baru
ALTER TABLE job_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_costs ENABLE ROW LEVEL SECURITY;

-- ─── POLICY: tenant_isolation ────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_iso_job_positions" ON job_positions;
CREATE POLICY "tenant_iso_job_positions" ON job_positions
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_iso_employees" ON employees;
CREATE POLICY "tenant_iso_employees" ON employees
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_iso_attendances" ON attendances;
CREATE POLICY "tenant_iso_attendances" ON attendances
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_iso_payroll_periods" ON payroll_periods;
CREATE POLICY "tenant_iso_payroll_periods" ON payroll_periods
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_iso_payroll_items" ON payroll_items;
CREATE POLICY "tenant_iso_payroll_items" ON payroll_items
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_iso_operational_costs" ON operational_costs;
CREATE POLICY "tenant_iso_operational_costs" ON operational_costs
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
