-- Add missing error_message column to excel_files table
ALTER TABLE excel_files ADD COLUMN IF NOT EXISTS error_message TEXT;
