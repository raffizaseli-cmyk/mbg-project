"""
Fix missing payable records for tenant 038ca365.
These 2 hutang transactions were confirmed but their payable inserts failed silently.
"""
import os
from datetime import date, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("backend/.env")
url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(url, key)

# Transactions that are missing payable records
missing_trx_ids = [
    "2d4c3ca5-918a-46f1-8a4f-ccfb28e0957e",  # 2023-02-15, 400000
    "6cb54de5-6ac1-4518-9283-81dc84ca5039",  # 2026-08-02, 188000
]

for trx_id in missing_trx_ids:
    # Check if payable already exists (in case it was manually inserted earlier)
    existing = supabase.table("payables").select("id").eq("transaction_id", trx_id).execute()
    if existing.data:
        print(f"[SKIP] Payable already exists for trx {trx_id[:8]}: {existing.data[0]['id']}")
        continue

    # Get transaction data
    trx_resp = supabase.table("transactions").select("*").eq("id", trx_id).execute()
    trx = trx_resp.data[0] if trx_resp.data else None
    if not trx:
        print(f"[ERROR] Transaction {trx_id[:8]} not found")
        continue

    # Build payable
    supplier_name = trx.get("nama_toko") or trx.get("ref_number") or f"Hutang Nota {trx.get('date', 'unknown')}"
    trx_date_str = trx.get("date") or date.today().isoformat()
    try:
        trx_dt = date.fromisoformat(trx_date_str)
    except ValueError:
        trx_dt = date.today()
    due_date = (trx_dt + timedelta(days=30)).isoformat()

    payable_data = {
        "tenant_id": trx["tenant_id"],
        "supplier_id": trx.get("supplier_id"),
        "transaction_id": trx_id,
        "supplier_name": supplier_name,
        "amount": trx.get("total", "0.00"),
        "paid_amount": "0.00",
        "due_date": due_date,
        "status": "unpaid",
    }

    print(f"\n[INSERT] Creating payable for trx {trx_id[:8]}:")
    print(f"  Supplier: {supplier_name}")
    print(f"  Amount  : {trx.get('total')}")
    print(f"  Due Date: {due_date}")

    try:
        resp = supabase.table("payables").insert(payable_data).execute()
        print(f"  Result  : OK - id={resp.data[0]['id']}")
    except Exception as e:
        print(f"  Result  : FAILED - {e}")

print("\nDone.")
