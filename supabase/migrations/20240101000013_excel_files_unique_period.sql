-- Add unique constraint on tenant_id, period to excel_files for upsert
ALTER TABLE excel_files ADD CONSTRAINT uq_excel_files_tenant_period UNIQUE (tenant_id, period);
