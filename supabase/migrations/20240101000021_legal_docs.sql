-- Tracking dokumen legal yang sudah digenerate
CREATE TABLE legal_documents (
  id              UUID PRIMARY KEY
                  DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id)
                  ON DELETE CASCADE,
  doc_type        TEXT NOT NULL,
  -- spt / bap / excel_dinas
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL,
  file_url        TEXT,
  -- URL di Supabase Storage
  status          TEXT DEFAULT 'draft',
  -- draft / final / submitted
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  submitted_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, doc_type, year, month)
);

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_legal_docs" ON legal_documents;
CREATE POLICY "tenant_isolation_legal_docs"
  ON legal_documents FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM users
      WHERE id = auth.uid()
    )
  );
