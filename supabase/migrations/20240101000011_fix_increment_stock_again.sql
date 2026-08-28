-- Remove updated_at from increment_stock because products doesn't have it
CREATE OR REPLACE FUNCTION increment_stock(
  p_product_id UUID,
  p_tenant_id UUID,
  p_delta DECIMAL(15,3)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET stock_qty = stock_qty + p_delta
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found for tenant %',
      p_product_id, p_tenant_id;
  END IF;
END;
$$;
