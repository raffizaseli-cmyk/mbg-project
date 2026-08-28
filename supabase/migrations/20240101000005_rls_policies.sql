-- 005_rls_policies.sql
-- Enable Row Level Security and tenant isolation policies

-- Helper comment:
-- Apply tenant_isolation to all tables that have tenant_id column.

-- USERS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- PRODUCTS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- SUPPLIERS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON suppliers
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- SCHOOLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON schools
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- PERIODS
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON periods
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY no_delete_locked_period ON periods
  FOR DELETE USING (status = 'open');

-- TRANSACTIONS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON transactions
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY no_edit_locked ON transactions
  FOR UPDATE USING (is_locked = false);
CREATE POLICY no_delete_locked ON transactions
  FOR DELETE USING (is_locked = false);

-- TRANSACTION ITEMS
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON transaction_items
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- STOCK HISTORY
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_history
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- PRICE HISTORY
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON price_history
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- RECIPES
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON recipes
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- PRODUCT ALIASES
ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON product_aliases
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- RECEIVABLES
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON receivables
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- PAYABLES
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payables
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- CASHFLOW LOG
ALTER TABLE cashflow_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cashflow_log
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- NOTA VALIDATIONS
ALTER TABLE nota_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON nota_validations
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- SCHEDULES
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON schedules
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- AUDIT LOG
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_log
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- PHOTO BATCHES
ALTER TABLE photo_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON photo_batches
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- MBG WEEKLY MENUS
ALTER TABLE mbg_weekly_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mbg_weekly_menus
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- MBG DELIVERIES
ALTER TABLE mbg_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mbg_deliveries
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY no_edit_locked_delivery ON mbg_deliveries
  FOR UPDATE USING (is_locked = false);

-- MBG BUDGET ALLOCATIONS
ALTER TABLE mbg_budget_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mbg_budget_allocations
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- MBG ALLOCATION SETTINGS
ALTER TABLE mbg_allocation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mbg_allocation_settings
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- EXCEL FILES
ALTER TABLE excel_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON excel_files
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );


