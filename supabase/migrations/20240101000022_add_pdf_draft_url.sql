-- Add pdf_draft_url column to mbg_budget_allocations table
ALTER TABLE mbg_budget_allocations
ADD COLUMN IF NOT EXISTS pdf_draft_url TEXT;
