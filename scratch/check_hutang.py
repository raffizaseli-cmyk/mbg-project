import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("backend/.env")
url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(url, key)

# 1. Check payables table
print("=" * 70)
print("1. SEMUA DATA DI TABEL payables")
print("=" * 70)
try:
    resp = supabase.table("payables").select("*").execute()
    rows = resp.data or []
    print(f"Total rows: {len(rows)}")
    for i, r in enumerate(rows, 1):
        print(f"\n--- Payable #{i} ---")
        for k, v in r.items():
            print(f"  {k}: {v}")
except Exception as e:
    print(f"Error: {e}")

# 2. Check confirmed transactions with hutang
print("\n" + "=" * 70)
print("2. TRANSAKSI CONFIRMED DENGAN payment_method='hutang'")
print("=" * 70)
try:
    resp = supabase.table("transactions").select(
        "id, ref_number, nama_toko, total, payment_method, payment_status, status, date, tenant_id"
    ).eq("status", "confirmed").eq("payment_method", "hutang").execute()
    rows = resp.data or []
    print(f"Total: {len(rows)}")
    for i, r in enumerate(rows, 1):
        print(f"\n--- Trx #{i} ---")
        for k, v in r.items():
            print(f"  {k}: {v}")
except Exception as e:
    print(f"Error: {e}")

# 3. Check ALL confirmed transactions to see payment methods used
print("\n" + "=" * 70)
print("3. SEMUA TRANSAKSI CONFIRMED (payment_method breakdown)")
print("=" * 70)
try:
    resp = supabase.table("transactions").select(
        "id, ref_number, total, payment_method, payment_status, status, date"
    ).eq("status", "confirmed").order("date", desc=True).execute()
    rows = resp.data or []
    print(f"Total confirmed: {len(rows)}")
    methods = {}
    for r in rows:
        m = r.get("payment_method") or "NULL"
        methods[m] = methods.get(m, 0) + 1
    print(f"\nPayment method breakdown:")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c} transaksi")
    
    # Show first few with payment details
    print(f"\nSample (first 10):")
    for i, r in enumerate(rows[:10], 1):
        print(f"  {i}. [{r.get('date')}] {r.get('ref_number') or r.get('id')[:8]} | total={r.get('total')} | method={r.get('payment_method')} | status={r.get('payment_status')}")
except Exception as e:
    print(f"Error: {e}")

# 4. Check payables table schema
print("\n" + "=" * 70)
print("4. SCHEMA TABEL payables (via RPC)")
print("=" * 70)
try:
    resp = supabase.rpc("get_table_columns", {"p_table": "payables"}).execute()
    cols = resp.data or []
    for c in cols:
        print(f"  {c}")
except Exception:
    # fallback: try inserting dummy to see error
    print("  (RPC not available, checking via select)")
    try:
        resp = supabase.table("payables").select("*").limit(1).execute()
        if resp.data:
            print(f"  Columns: {list(resp.data[0].keys())}")
        else:
            print("  Table exists but empty")
    except Exception as e2:
        print(f"  Error: {e2}")
