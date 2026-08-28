-- Prevent duplicate product names within the same tenant
-- This ensures no two products can have the same name (case-insensitive) for one tenant

-- Create a unique index on lower(name) + tenant_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_name_unique
  ON products (tenant_id, lower(trim(name)));
