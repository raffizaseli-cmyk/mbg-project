-- Menambahkan kolom fiber (serat) ke dalam tabel nutrition_ref
ALTER TABLE nutrition_ref ADD COLUMN IF NOT EXISTS fiber FLOAT DEFAULT 0.0;
