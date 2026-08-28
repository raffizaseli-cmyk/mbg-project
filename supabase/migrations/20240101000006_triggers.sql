-- 006_triggers.sql
-- Triggers: price history logging, audit log, and stock increment function

-- Function: increment_stock (atomic stock update)
CREATE OR REPLACE FUNCTION increment_stock(
  p_product_id UUID,
  p_delta      NUMERIC,
  p_tenant_id  UUID
) RETURNS NUMERIC AS $$
BEGIN
  UPDATE products
  SET stock_qty = stock_qty + p_delta
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id;

  RETURN (SELECT stock_qty FROM products WHERE id = p_product_id);
END;
$$ LANGUAGE plpgsql;

-- Function: log_price_change
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.hpp IS DISTINCT FROM OLD.hpp) THEN
    INSERT INTO price_history (
      id,
      tenant_id,
      product_id,
      price_type,
      old_price,
      new_price,
      changed_by,
      effective_date,
      created_at
    ) VALUES (
      gen_random_uuid(),
      NEW.tenant_id,
      NEW.id,
      'hpp',
      OLD.hpp,
      NEW.hpp,
      NULL,              -- changed_by (optional, can be filled from app layer)
      CURRENT_DATE,
      NOW()
    );
  END IF;

  IF (NEW.sell_price IS DISTINCT FROM OLD.sell_price) THEN
    INSERT INTO price_history (
      id,
      tenant_id,
      product_id,
      price_type,
      old_price,
      new_price,
      changed_by,
      effective_date,
      created_at
    ) VALUES (
      gen_random_uuid(),
      NEW.tenant_id,
      NEW.id,
      'sell_price',
      OLD.sell_price,
      NEW.sell_price,
      NULL,              -- changed_by (optional)
      CURRENT_DATE,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_price_change
AFTER UPDATE ON products
FOR EACH ROW
WHEN (OLD.hpp IS DISTINCT FROM NEW.hpp OR OLD.sell_price IS DISTINCT FROM NEW.sell_price)
EXECUTE FUNCTION log_price_change();

-- Function: log_audit for transactions
CREATE OR REPLACE FUNCTION log_transaction_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_tenant UUID;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_action := 'insert';
    v_tenant := NEW.tenant_id;
    INSERT INTO audit_log (
      id,
      tenant_id,
      user_id,
      action,
      resource,
      resource_id,
      old_data,
      new_data,
      created_at
    ) VALUES (
      gen_random_uuid(),
      v_tenant,
      NULL,                     -- user_id optional, can be set from app layer if needed
      v_action,
      'transactions',
      NEW.id,
      NULL,
      to_jsonb(NEW),
      NOW()
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action := 'update';
    v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
    INSERT INTO audit_log (
      id,
      tenant_id,
      user_id,
      action,
      resource,
      resource_id,
      old_data,
      new_data,
      created_at
    ) VALUES (
      gen_random_uuid(),
      v_tenant,
      NULL,
      v_action,
      'transactions',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      NOW()
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    v_action := 'delete';
    v_tenant := OLD.tenant_id;
    INSERT INTO audit_log (
      id,
      tenant_id,
      user_id,
      action,
      resource,
      resource_id,
      old_data,
      new_data,
      created_at
    ) VALUES (
      gen_random_uuid(),
      v_tenant,
      NULL,
      v_action,
      'transactions',
      OLD.id,
      to_jsonb(OLD),
      NULL,
      NOW()
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_transaction_audit
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION log_transaction_audit();


