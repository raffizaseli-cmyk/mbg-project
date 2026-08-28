-- Check Test Data for Excel Export
-- Run these queries in Supabase SQL Editor to verify you have data for testing

-- ═══════════════════════════════════════════════════════════════════════════════

-- 1️⃣ Check total MBG deliveries (all months/years)
SELECT 
  COUNT(*) as total_deliveries,
  COUNT(DISTINCT DATE(delivery_date)) as unique_delivery_dates,
  COUNT(DISTINCT tenant_id) as unique_tenants,
  MIN(delivery_date) as earliest_date,
  MAX(delivery_date) as latest_date
FROM mbg_deliveries;

-- ═══════════════════════════════════════════════════════════════════════════════

-- 2️⃣ Check deliveries for current month (March 2026)
SELECT 
  DATE(delivery_date) as del_date,
  COUNT(*) as delivery_count,
  SUM(portions_sent) as total_porsi
FROM mbg_deliveries
WHERE delivery_date >= '2026-03-01' AND delivery_date < '2026-04-01'
GROUP BY DATE(delivery_date)
ORDER BY del_date;

-- ═══════════════════════════════════════════════════════════════════════════════

-- 3️⃣ Check budget allocations for current month (March 2026)
SELECT 
  DATE(date) as alloc_date,
  COUNT(*) as allocation_count,
  SUM(CAST(total_portions AS INTEGER)) as total_porsi,
  SUM(CAST(budget_bahan AS DECIMAL)) as total_bahan,
  SUM(CAST(budget_ops AS DECIMAL)) as total_ops,
  SUM(CAST(budget_insentif AS DECIMAL)) as total_profit
FROM mbg_budget_allocations
WHERE date >= '2026-03-01' AND date < '2026-04-01'
GROUP BY DATE(date)
ORDER BY alloc_date;

-- ═══════════════════════════════════════════════════════════════════════════════

-- 4️⃣ Check confirmed transactions (for Pembelian & Pengeluaran sheet)
SELECT 
  COUNT(*) as total_confirmed_trx,
  COUNT(DISTINCT DATE(date)) as unique_trx_dates,
  SUM(CAST(total AS DECIMAL)) as total_amount,
  MIN(date) as earliest_trx,
  MAX(date) as latest_trx
FROM transactions
WHERE status = 'confirmed'
  AND date >= '2026-03-01' AND date < '2026-04-01';

-- ═══════════════════════════════════════════════════════════════════════════════

-- 5️⃣ Check if receivables were created (should link to deliveries)
SELECT 
  COUNT(*) as total_receivables,
  COUNT(*) FILTER (WHERE component_bahan IS NOT NULL) as with_breakdown,
  COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid_count,
  SUM(CAST(amount AS DECIMAL)) as total_amount
FROM receivables
WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01';

-- ═══════════════════════════════════════════════════════════════════════════════

-- 6️⃣ Sample: Check 1 delivery with its related data
SELECT 
  d.id as delivery_id,
  d.delivery_date,
  d.portions_sent,
  s.name as school_name,
  s.school_level,
  ba.budget_bahan,
  ba.budget_ops,
  ba.budget_insentif,
  ba.total_revenue,
  r.amount as receivable_amount,
  r.component_bahan,
  r.component_ops,
  r.component_insentif
FROM mbg_deliveries d
LEFT JOIN schools s ON d.school_id = s.id
LEFT JOIN mbg_budget_allocations ba ON ba.date = d.delivery_date AND ba.tenant_id = d.tenant_id
LEFT JOIN receivables r ON r.created_at >= d.delivery_date AND r.created_at < d.delivery_date + INTERVAL '1 day'
WHERE d.delivery_date >= '2026-03-01' AND d.delivery_date < '2026-04-01'
LIMIT 1;

-- ═══════════════════════════════════════════════════════════════════════════════

-- HASIL YANG DIHARAPKAN:
-- ✅ Query 1-2: Harus ada delivery records (portions_sent > 0)
-- ✅ Query 3: Harus ada budget allocations dengan bahan + ops + insentif
-- ✅ Query 4: Harus ada confirmed transactions untuk Pembelian sheet
-- ✅ Query 5: Harus ada receivables dengan component breakdown
-- ✅ Query 6: Sample data linking semuanya bersama

-- JIKA SEMUA 0 (tidak ada data):
-- → Perlu input data dulu via bot (/serah + /belanja) sebelum test Excel

-- JIKA ADA DATA (>0 pada Q1-Q5):
-- → Siap test Excel download via web atau bot
