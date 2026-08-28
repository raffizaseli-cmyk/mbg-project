-- Ledger kas (immutable — jangan pernah hapus)
-- Setiap pergerakan kas = 1 baris
CREATE TABLE IF NOT EXISTS kas_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  kas_account_id  UUID REFERENCES kas_accounts(id),
  entry_type      TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  amount          DECIMAL(15,2) NOT NULL,
  balance_after   DECIMAL(15,2) NOT NULL,
  reference_type  TEXT NOT NULL CHECK (reference_type IN ('disbursement', 'transfer', 'expense', 'payroll', 'return_to_gov', 'income')),
  reference_id    UUID,
  description     TEXT NOT NULL,
  entry_date      DATE NOT NULL,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE kas_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_kas_ledger" ON kas_ledger;
CREATE POLICY "tenant_isolation_kas_ledger" ON kas_ledger
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM users
      WHERE id = auth.uid()
    )
  );

-- Index untuk performa query ledger
CREATE INDEX IF NOT EXISTS idx_kas_ledger_account ON kas_ledger(kas_account_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_kas_ledger_tenant ON kas_ledger(tenant_id, entry_date);
