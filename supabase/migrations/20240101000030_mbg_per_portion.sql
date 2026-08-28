-- Migration: Add per-portion allocation config to schools and new budget fields

-- 1. Add `mbg_allocation_type` to `schools`
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS mbg_allocation_type VARCHAR(20) DEFAULT 'large';

-- 2. Add breakdown columns to `mbg_budget_allocations`
ALTER TABLE mbg_budget_allocations
ADD COLUMN IF NOT EXISTS allocation_type VARCHAR(20) DEFAULT 'large',
ADD COLUMN IF NOT EXISTS budget_raw_material NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_operational NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_kitchen_rent NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS operational_salary NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS operational_fuel NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS operational_utilities NUMERIC(15,2) DEFAULT 0;

-- Optionally, we retain `budget_food`, `budget_labor`, `budget_ops` for backward compatibility or we can just leave them as is. Let's leave them.
