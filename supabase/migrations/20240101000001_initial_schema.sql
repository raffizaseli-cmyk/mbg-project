-- 001_initial_schema.sql
-- Initial multi-tenant schema for catering & MBG system

-- Enable pgcrypto for gen_random_uuid (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TENANTS (root entity, no tenant_id)
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  owner_email   TEXT NOT NULL,
  phone         TEXT,
  address       TEXT,
  business_type TEXT DEFAULT 'catering',    -- catering / mbg / both
  plan          TEXT DEFAULT 'free',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  telegram_id   BIGINT UNIQUE,
  email         TEXT UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT DEFAULT 'kasir',        -- owner / admin / kasir / viewer
  password_hash TEXT,
  session_token TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sku           TEXT,
  category      TEXT,                        -- bahan_baku / produk_jadi / packaging
  unit          TEXT DEFAULT 'pcs',
  hpp           DECIMAL(15,2) DEFAULT 0,     -- [UANG]
  sell_price    DECIMAL(15,2) DEFAULT 0,     -- [UANG]
  stock_qty     DECIMAL(15,3) DEFAULT 0,     -- [QTY]
  stock_min     DECIMAL(15,3) DEFAULT 0,     -- [QTY]
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  alias_names   TEXT[],
  phone         TEXT,
  address       TEXT,
  category      TEXT,                        -- sembako / bumbu / packaging / jasa
  is_pkp        BOOLEAN DEFAULT false,       -- TRUE = supplier PKP, ada PPN di nota
  is_active     BOOLEAN DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);

-- SCHOOLS (generic schools for MBG deliveries)
CREATE TABLE IF NOT EXISTS schools (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,
  external_id      VARCHAR(100), -- ID dari spreadsheet lama, if any
  name             VARCHAR(255) NOT NULL,
  address          TEXT,
  principal_name   VARCHAR(255),
  contact_number   VARCHAR(50),
  default_portions INTEGER DEFAULT 0,
  school_level     VARCHAR(20) DEFAULT 'sd_smp', -- 'sd_smp' or 'paud_tk'
  target_portions  INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_schools_tenant_id ON schools(tenant_id);

-- PERIODS
CREATE TABLE IF NOT EXISTS periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        TEXT DEFAULT 'open',       -- open / locked
  locked_by     UUID REFERENCES users(id),
  locked_at     TIMESTAMPTZ,
  report_url    TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, start_date, end_date)
);
CREATE INDEX IF NOT EXISTS idx_periods_tenant_id ON periods(tenant_id);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  supplier_id   UUID REFERENCES suppliers(id),   -- nullable
  period_id     UUID REFERENCES periods(id),     -- nullable
  type          TEXT NOT NULL,                   -- income / expense / purchase
  source        TEXT DEFAULT 'manual',
  ref_number    TEXT,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal      DECIMAL(15,2) DEFAULT 0,         -- [UANG] sebelum pajak
  ppn_amount    DECIMAL(15,2) DEFAULT 0,         -- [UANG]
  pph22_amount  DECIMAL(15,2) DEFAULT 0,         -- [UANG]
  discount      DECIMAL(15,2) DEFAULT 0,         -- [UANG]
  total         DECIMAL(15,2) NOT NULL,          -- [UANG] final
  notes         TEXT,
  photo_url     TEXT,
  pdf_url       TEXT,
  status        TEXT DEFAULT 'confirmed',        -- pending / confirmed / voided
  is_locked     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- TRANSACTION ITEMS
CREATE TABLE IF NOT EXISTS transaction_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID REFERENCES transactions(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  product_name    TEXT NOT NULL,
  qty             DECIMAL(15,3) NOT NULL,    -- [QTY]
  unit            TEXT,
  price           DECIMAL(15,2) NOT NULL,    -- [UANG]
  hpp_snapshot    DECIMAL(15,2),             -- [UANG]
  has_ppn         BOOLEAN DEFAULT false,
  subtotal        DECIMAL(15,2) NOT NULL,    -- [UANG]
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transaction_items_tenant_id ON transaction_items(tenant_id);

-- STOCK HISTORY (immutable)
CREATE TABLE IF NOT EXISTS stock_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  transaction_id  UUID REFERENCES transactions(id),
  change_qty      DECIMAL(15,3) NOT NULL,  -- [QTY]
  balance_after   DECIMAL(15,3) NOT NULL,  -- [QTY]
  reason          TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_history_tenant_id ON stock_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_product_id ON stock_history(product_id);

-- PRICE HISTORY
CREATE TABLE IF NOT EXISTS price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  price_type      TEXT NOT NULL,             -- hpp / sell_price
  old_price       DECIMAL(15,2),             -- [UANG]
  new_price       DECIMAL(15,2) NOT NULL,    -- [UANG]
  changed_by      UUID REFERENCES users(id),
  effective_date  DATE DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_price_history_tenant_id ON price_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);

-- RECIPES / BOM
CREATE TABLE IF NOT EXISTS recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  menu_id         UUID REFERENCES products(id),
  ingredient_id   UUID REFERENCES products(id),
  qty_needed      DECIMAL(15,3) NOT NULL,    -- [QTY] per 1 porsi
  unit            TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, menu_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_recipes_tenant_id ON recipes(tenant_id);

-- PRODUCT ALIASES
CREATE TABLE IF NOT EXISTS product_aliases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  alias_name      TEXT NOT NULL,
  source          TEXT DEFAULT 'manual',     -- manual / ai
  confidence      DECIMAL(3,2) DEFAULT 1.0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, alias_name)
);
CREATE INDEX IF NOT EXISTS idx_product_aliases_tenant_id ON product_aliases(tenant_id);

-- RECEIVABLES
CREATE TABLE IF NOT EXISTS receivables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES transactions(id),
  party_name      TEXT NOT NULL,
  party_type      TEXT DEFAULT 'customer',   -- customer / mbg_gov / other
  amount          DECIMAL(15,2) NOT NULL,    -- [UANG]
  pph22_amount    DECIMAL(15,2) DEFAULT 0,   -- [UANG]
  paid_amount     DECIMAL(15,2) DEFAULT 0,   -- [UANG]
  remaining       DECIMAL(15,2) GENERATED ALWAYS AS (amount - pph22_amount - paid_amount) STORED,
  due_date        DATE,
  status          TEXT DEFAULT 'unpaid',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receivables_tenant_id ON receivables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);

-- PAYABLES
CREATE TABLE IF NOT EXISTS payables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES suppliers(id),
  transaction_id  UUID REFERENCES transactions(id),
  supplier_name   TEXT NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,    -- [UANG]
  paid_amount     DECIMAL(15,2) DEFAULT 0,   -- [UANG]
  remaining       DECIMAL(15,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
  due_date        DATE,
  status          TEXT DEFAULT 'unpaid',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payables_tenant_id ON payables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(status);

-- CASHFLOW LOG
CREATE TABLE IF NOT EXISTS cashflow_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES transactions(id),
  flow_type       TEXT NOT NULL,             -- in / out
  category        TEXT,
  amount          DECIMAL(15,2) NOT NULL,    -- [UANG]
  description     TEXT,
  date            DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cashflow_log_tenant_id ON cashflow_log(tenant_id);

-- NOTA VALIDATIONS
CREATE TABLE IF NOT EXISTS nota_validations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES transactions(id),
  validator       TEXT DEFAULT 'ai',
  result          TEXT,
  flags           JSONB,
  ai_raw          TEXT,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nota_validations_tenant_id ON nota_validations(tenant_id);

-- SCHEDULES
CREATE TABLE IF NOT EXISTS schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  type            TEXT NOT NULL,             -- customer_order/restock/payment/production/delivery/mbg_daily
  title           TEXT NOT NULL,
  customer_name   TEXT,
  description     TEXT,
  scheduled_date  DATE NOT NULL,
  scheduled_time  TIME,
  qty             DECIMAL(15,3),
  amount          DECIMAL(15,2),
  status          TEXT DEFAULT 'scheduled',
  reminder_sent   BOOLEAN DEFAULT false,
  linked_trx_id   UUID REFERENCES transactions(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant_id ON schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

-- AUDIT LOG (immutable)
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  action          TEXT NOT NULL,
  resource        TEXT,
  resource_id     UUID,
  old_data        JSONB,
  new_data        JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON audit_log(tenant_id);

-- PHOTO_BATCHES
CREATE TABLE IF NOT EXISTS photo_batches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES users(id),
  status             TEXT DEFAULT 'collecting',
  total_photos       INTEGER DEFAULT 0,
  processed_photos   INTEGER DEFAULT 0,
  collection_timeout TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_photo_batches_tenant_id ON photo_batches(tenant_id);


