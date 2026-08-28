import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join("backend", ".env"))

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("No DATABASE_URL found in backend/.env")
    exit(1)

sql_file = os.path.join("supabase", "migrations", "20260616080000_increment_batch_counter.sql")
with open(sql_file, "r") as f:
    sql = f.read()

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    cursor.execute(sql)
    print("Migration applied successfully.")
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
