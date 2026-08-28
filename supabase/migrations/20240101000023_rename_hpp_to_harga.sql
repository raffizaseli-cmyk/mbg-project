-- Rename products.hpp -> products.harga (safe, no data loss)
ALTER TABLE products RENAME COLUMN hpp TO harga;

-- Rename transaction_items.hpp_snapshot -> transaction_items.harga_snapshot
ALTER TABLE transaction_items RENAME COLUMN hpp_snapshot TO harga_snapshot;

-- Update trigger function to use 'harga' instead of 'hpp'
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.harga IS DISTINCT FROM OLD.harga) THEN
    INSERT INTO price_history (tenant_id, product_id, price_type, old_price, new_price, changed_by)
    VALUES (NEW.tenant_id, NEW.id, 'harga', OLD.harga, NEW.harga, NEW.tenant_id);
  END IF;
  IF (NEW.sell_price IS DISTINCT FROM OLD.sell_price) THEN
    INSERT INTO price_history (tenant_id, product_id, price_type, old_price, new_price, changed_by)
    VALUES (NEW.tenant_id, NEW.id, 'sell_price', OLD.sell_price, NEW.sell_price, NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with updated condition
DROP TRIGGER IF EXISTS trg_price_change ON products;
CREATE TRIGGER trg_price_change
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.harga IS DISTINCT FROM NEW.harga OR OLD.sell_price IS DISTINCT FROM NEW.sell_price)
  EXECUTE FUNCTION log_price_change();
