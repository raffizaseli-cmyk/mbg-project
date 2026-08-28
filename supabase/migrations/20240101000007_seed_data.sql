-- 007_seed_data.sql
-- Seed data for initial testing tenant

DO $$
DECLARE
  v_tenant_id UUID;
  v_owner_id  UUID;
  v_beras_id  UUID;
  v_telur_id  UUID;
  v_minyak_id UUID;
  v_nasi_goreng_id UUID;
  v_nasi_ayam_id   UUID;
  v_supplier_id    UUID;
  v_school1_id     UUID;
  v_school2_id     UUID;
BEGIN
  -- Tenant
  INSERT INTO tenants (name, slug, owner_email, phone, address, business_type, plan)
  VALUES ('Catering Uji Coba', 'uji-coba', 'owner@uji-coba.local', '0800000000', 'Alamat Contoh', 'mbg', 'free')
  RETURNING id INTO v_tenant_id;

  -- Owner user
  INSERT INTO users (tenant_id, email, name, role, is_active)
  VALUES (v_tenant_id, 'owner@uji-coba.local', 'Owner Uji Coba', 'owner', true)
  RETURNING id INTO v_owner_id;

  -- Bahan baku
  INSERT INTO products (tenant_id, name, category, unit, hpp, stock_qty, stock_min, is_active)
  VALUES
    (v_tenant_id, 'Beras', 'bahan_baku', 'kg',    14000, 0, 0, true),
    (v_tenant_id, 'Telur', 'bahan_baku', 'pcs',   1500,  0, 0, true),
    (v_tenant_id, 'Minyak Goreng', 'bahan_baku', 'liter', 16000, 0, 0, true)
  RETURNING
    (SELECT id FROM products WHERE tenant_id = v_tenant_id AND name = 'Beras') AS beras_id;

  -- Ambil id bahan baku satu per satu
  SELECT id INTO v_beras_id FROM products WHERE tenant_id = v_tenant_id AND name = 'Beras';
  SELECT id INTO v_telur_id FROM products WHERE tenant_id = v_tenant_id AND name = 'Telur';
  SELECT id INTO v_minyak_id FROM products WHERE tenant_id = v_tenant_id AND name = 'Minyak Goreng';

  -- Produk jadi
  INSERT INTO products (tenant_id, name, category, unit, hpp, stock_qty, stock_min, is_active)
  VALUES
    (v_tenant_id, 'Nasi Goreng', 'produk_jadi', 'porsi', 0, 0, 0, true),
    (v_tenant_id, 'Nasi Putih + Ayam', 'produk_jadi', 'porsi', 0, 0, 0, true);

  SELECT id INTO v_nasi_goreng_id FROM products WHERE tenant_id = v_tenant_id AND name = 'Nasi Goreng';
  SELECT id INTO v_nasi_ayam_id   FROM products WHERE tenant_id = v_tenant_id AND name = 'Nasi Putih + Ayam';

  -- Supplier
  INSERT INTO suppliers (tenant_id, name, is_pkp, is_active)
  VALUES (v_tenant_id, 'Toko Pak Ahmad', false, true)
  RETURNING id INTO v_supplier_id;

  -- Sekolah
  INSERT INTO schools (tenant_id, name, address, contact_name, default_portions, is_active)
  VALUES
    (v_tenant_id, 'SDN 01 Contoh', 'Alamat SDN 01', 'Kepala Sekolah 01', 300, true),
    (v_tenant_id, 'SDN 02 Contoh', 'Alamat SDN 02', 'Kepala Sekolah 02', 250, true);

  SELECT id INTO v_school1_id FROM schools WHERE tenant_id = v_tenant_id AND name = 'SDN 01 Contoh';
  SELECT id INTO v_school2_id FROM schools WHERE tenant_id = v_tenant_id AND name = 'SDN 02 Contoh';

  -- Resep Nasi Goreng: Beras 0.15kg + Telur 1pcs + Minyak 0.02liter per porsi
  INSERT INTO recipes (tenant_id, menu_id, ingredient_id, qty_needed, unit)
  VALUES
    (v_tenant_id, v_nasi_goreng_id, v_beras_id, 0.150, 'kg'),
    (v_tenant_id, v_nasi_goreng_id, v_telur_id, 1.000, 'pcs'),
    (v_tenant_id, v_nasi_goreng_id, v_minyak_id, 0.020, 'liter');

  -- MBG allocation settings default
  INSERT INTO mbg_allocation_settings (
    tenant_id,
    price_per_portion,
    food_per_portion,
    labor_per_portion,
    ops_per_portion
  ) VALUES (
    v_tenant_id,
    15000,
    10000,
    2250,
    2750
  );
END;
$$;


