import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env")
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

import sys
with open("out.txt", "w", encoding="utf-8") as f:
    sys.stdout = f
    
    try:
        prod_resp = supabase.table("products").select("id, tenant_id, name, stock_qty, harga, category").in_("name", ["ayam", "beras", "Ayam", "Beras"]).execute()
        print("\nPRODUCTS ACROSS ALL TENANTS:")
        for p in prod_resp.data:
            print(p)
    except Exception as e:
        print(f"Error getting products: {e}")

    try:
        trx_resp = supabase.table("transactions").select("id, tenant_id, date, total, status").order("created_at", desc=True).limit(5).execute()
        print("\nRECENT TRANSACTIONS:")
        for t in trx_resp.data:
            print(t)

        ids = [t["id"] for t in trx_resp.data]
        if ids:
            items_resp = supabase.table("transaction_items").select("transaction_id, product_id, product_name, qty, price, has_ppn").in_("transaction_id", ids).execute()
            print("\nRECENT ITEMS:")
            for i in items_resp.data:
                print(i)
    except Exception as e:
        print(f"Error transactions: {e}")

