-- Migration: Add receivables breakdown columns
-- Date: 2026-03-28
-- Purpose: Track bahan, ops, insentif separately in receivables table
-- Status: To be executed in Supabase SQL Editor

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS
    component_bahan DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS
    component_ops DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS
    component_insentif DECIMAL(15,2) DEFAULT 0;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'receivables' 
  AND column_name LIKE 'component_%'
ORDER BY column_name;

-- Note: component_bahan + component_ops + component_insentif should = amount
