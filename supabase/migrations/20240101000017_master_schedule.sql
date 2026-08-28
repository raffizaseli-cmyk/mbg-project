-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Master Schedule + AI Jadwal Operasional
-- ═══════════════════════════════════════════════════════════════════════════════

-- Master schedule = template waktu operasional dapur
CREATE TABLE IF NOT EXISTS master_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT DEFAULT 'Jadwal Utama',
  prep_start_time   TIME DEFAULT '06:30',
  cook_start_time   TIME DEFAULT '07:00',
  cook_end_time     TIME DEFAULT '09:30',
  cook_minutes_per_100 INTEGER DEFAULT 30,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Template waktu per sekolah
CREATE TABLE IF NOT EXISTS master_schedule_schools (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  master_id         UUID REFERENCES master_schedules(id) ON DELETE CASCADE,
  school_id         UUID REFERENCES schools(id),
  target_arrival    TIME NOT NULL,
  travel_minutes    INTEGER DEFAULT 30,
  delivery_window_minutes INTEGER DEFAULT 15,
  day_of_week       INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(master_id, school_id, day_of_week)
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE master_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_schedule_schools ENABLE ROW LEVEL SECURITY;

-- master_schedules policies
CREATE POLICY "master_schedules_select" ON master_schedules
  FOR SELECT USING (tenant_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "master_schedules_insert" ON master_schedules
  FOR INSERT WITH CHECK (tenant_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "master_schedules_update" ON master_schedules
  FOR UPDATE USING (tenant_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "master_schedules_delete" ON master_schedules
  FOR DELETE USING (tenant_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- master_schedule_schools policies
CREATE POLICY "master_schedule_schools_select" ON master_schedule_schools
  FOR SELECT USING (tenant_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "master_schedule_schools_insert" ON master_schedule_schools
  FOR INSERT WITH CHECK (tenant_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "master_schedule_schools_update" ON master_schedule_schools
  FOR UPDATE USING (tenant_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "master_schedule_schools_delete" ON master_schedule_schools
  FOR DELETE USING (tenant_id = auth.uid()
    OR tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
