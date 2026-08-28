import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("backend/.env")
url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(url, key)

trx_ids = ["2d4c3ca5-918a-46f1-8a4f-ccfb28e0957e", "6cb54de5-6ac1-4518-9283-81dc84ca5039"]

for tid in trx_ids:
    print("=" * 70)
    print("INSPECT TRANSACTION:", tid)
    print("=" * 70)
    resp = supabase.table("transactions").select("*").eq("id", tid).execute()
    trx = resp.data[0] if resp.data else None
    if trx:
        for k, v in trx.items():
            print(f"  {k}: {v}")
    
    # Try manual insert into payables to see if it fails (and why)!
    print("\n  Testing payables insert for this trx:")
    try:
        sup_name = trx.get("nama_toko") or "Supplier"
        ins = supabase.table("payables").insert({
            "tenant_id": trx["tenant_id"],
            "supplier_id": trx.get("supplier_id"),
            "transaction_id": trx["id"],
            "supplier_name": sup_name,
            "amount": trx.get("total", "0.00"),
            "paid_amount": "0.00",
            "due_date": trx.get("due_date"),
            "status": "unpaid",
        }).execute()
        print("  Insert SUCCEEDED:", ins.data)
    except Exception as e:
        print("  Insert FAILED with error:", e)
