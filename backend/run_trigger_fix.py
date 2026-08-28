import os
from dotenv import load_dotenv
import psycopg2

load_dotenv(".env")
db_url = os.environ.get("DATABASE_URL")

sql = """
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.harga IS DISTINCT FROM OLD.harga) THEN
    INSERT INTO price_history (tenant_id, product_id, price_type, old_price, new_price, changed_by)
    VALUES (NEW.tenant_id, NEW.id, 'harga', OLD.harga, NEW.harga, NULL);
  END IF;
  IF (NEW.sell_price IS DISTINCT FROM OLD.sell_price) THEN
    INSERT INTO price_history (tenant_id, product_id, price_type, old_price, new_price, changed_by)
    VALUES (NEW.tenant_id, NEW.id, 'sell_price', OLD.sell_price, NEW.sell_price, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute(sql)
    conn.commit()
    cur.close()
    conn.close()
    print("MIGRATION SUCCESS")
except Exception as e:
    print("MIGRATION ERROR:", e)
