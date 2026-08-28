-- Add packaging multiplier and unit to transaction_items
ALTER TABLE transaction_items 
  ADD COLUMN IF NOT EXISTS packaging_value NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS packaging_unit TEXT;

-- Add packaging multiplier and unit to product_aliases
ALTER TABLE product_aliases 
  ADD COLUMN IF NOT EXISTS packaging_value NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS packaging_unit TEXT;
