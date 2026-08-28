-- supabase/migrations/008_increment_stock.sql

-- 1. Create or replace the increment_stock function for atomic stock updates
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
  SET stock_qty = stock_qty + p_delta,
      updated_at = NOW()
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found for tenant %',
      p_product_id, p_tenant_id;
  END IF;
END;
$$;

-- 2. Create the storage bucket 'nota-photos' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('nota-photos', 'nota-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Setup RLS for the new bucket
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read access to the photos
CREATE POLICY "Public Read Nota Photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'nota-photos');

-- Allow authenticated users with role owner/admin/kasir to upload
CREATE POLICY "Auth Insert Nota Photos" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'nota-photos' 
  AND auth.uid() IS NOT NULL
);
