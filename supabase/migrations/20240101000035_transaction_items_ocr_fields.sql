-- Kolom pendukung OCR: nama asli nota + flag konfirmasi alias
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS ocr_nama_asli TEXT,
  ADD COLUMN IF NOT EXISTS needs_confirmation BOOLEAN DEFAULT false;
