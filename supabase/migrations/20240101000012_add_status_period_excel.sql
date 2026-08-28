-- Add missing columns status and period to excel_files

ALTER TABLE excel_files ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'not_generated';
ALTER TABLE excel_files ADD COLUMN IF NOT EXISTS period VARCHAR(10);

-- Make sure we have period unique constraint so we don't regenerate same period multiple times.
-- If period didn't exist, we might have year/month unique constraint.
-- It already has: UNIQUE(tenant_id, year, month)
