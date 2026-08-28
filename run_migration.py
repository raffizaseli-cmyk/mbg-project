"""Run migration via Supabase REST API (no psycopg2 needed)."""
import os
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join("backend", ".env"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    exit(1)

sql_file = os.path.join("supabase", "migrations", "20260616090000_add_packaging_fields.sql")
with open(sql_file, "r") as f:
    sql = f.read()

# Split into individual statements
statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

print(f"Running migration via Supabase REST RPC...")

# Use the rpc endpoint to run raw SQL via a custom function,
# or try direct table operations. Since we need ALTER TABLE,
# let's try using the management API or the SQL editor endpoint.
# Supabase doesn't have a direct SQL execution REST API for DDL.
# Instead, let's try using the supabase CLI or the dashboard.

# Alternative: Check if columns already exist by trying to query them
print("\nChecking if columns already exist...")

client = httpx.Client(timeout=30)

# Test transaction_items.packaging_value
try:
    resp = client.get(
        f"{SUPABASE_URL}/rest/v1/transaction_items",
        headers=headers,
        params={"select": "packaging_value,packaging_unit", "limit": "1"},
    )
    if resp.status_code == 200:
        print("[OK] transaction_items.packaging_value and packaging_unit columns EXIST")
    else:
        print(f"[ERROR] transaction_items check failed: {resp.status_code} {resp.text}")
        print("   You need to run the migration manually via Supabase Dashboard SQL Editor")
except Exception as e:
    print(f"[ERROR] Error: {e}")

# Test product_aliases.packaging_value
try:
    resp = client.get(
        f"{SUPABASE_URL}/rest/v1/product_aliases",
        headers=headers,
        params={"select": "packaging_value,packaging_unit", "limit": "1"},
    )
    if resp.status_code == 200:
        print("[OK] product_aliases.packaging_value and packaging_unit columns EXIST")
    else:
        print(f"[ERROR] product_aliases check failed: {resp.status_code} {resp.text}")
        print("   You need to run the migration manually via Supabase Dashboard SQL Editor")
except Exception as e:
    print(f"[ERROR] Error: {e}")

print("\n--- Migration SQL (copy to Supabase SQL Editor if needed) ---")
print(sql)
