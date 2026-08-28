-- Add payment and OCR related fields to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS nama_toko TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_pkp BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ocr_confidence DECIMAL(3,2);
