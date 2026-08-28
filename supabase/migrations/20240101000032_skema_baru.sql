-- Migration: New Juknis Component-based Scheme

-- 1. Add school_level to schools
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS school_level VARCHAR(20) DEFAULT 'sd_smp';

-- 2. Add dynamic component rates to mbg_allocation_settings
ALTER TABLE mbg_allocation_settings
ADD COLUMN IF NOT EXISTS bahan_sd_smp NUMERIC(15,2) DEFAULT 10000,
ADD COLUMN IF NOT EXISTS bahan_paud_tk NUMERIC(15,2) DEFAULT 8000,
ADD COLUMN IF NOT EXISTS ops_per_porsi NUMERIC(15,2) DEFAULT 3000,
ADD COLUMN IF NOT EXISTS insentif_harian NUMERIC(15,2) DEFAULT 6000000;

-- 3. Add exact budgets to mbg_budget_allocations
ALTER TABLE mbg_budget_allocations
ADD COLUMN IF NOT EXISTS budget_bahan NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_ops NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_insentif NUMERIC(15,2) DEFAULT 0;
