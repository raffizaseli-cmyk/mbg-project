import asyncio
import os
import sys

# Ensure backend dir is in sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.database import get_supabase
from core.config import settings

async def cek_data_async():
    # Use the project's existing sync client helper
    supabase = get_supabase()
    
    # Get first tenant
    t_resp = supabase.table("tenants").select("id, name").limit(1).execute()
    if not t_resp.data:
        print("No tenants found!")
        return
    
    tenant_id = t_resp.data[0]["id"]
    tenant_name = t_resp.data[0]["name"]
    print(f"Checking data for Tenant: {tenant_name} ({tenant_id})")
    
    first = "2026-03-01"
    last = "2026-03-31"
    
    # 1. Transactions - using exact count
    trx_count_resp = (
        supabase.table("transactions")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .eq("status", "confirmed")
        .gte("date", first)
        .lte("date", last)
        .execute()
    )
    print(f"Confirmed Transactions (March 2026): {getattr(trx_count_resp, 'count', 0)}")

    # 2. Deliveries
    del_count_resp = (
        supabase.table("mbg_deliveries")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .gte("delivery_date", first)
        .lte("delivery_date", last)
        .execute()
    )
    print(f"MBG Deliveries (March 2026): {getattr(del_count_resp, 'count', 0)}")
    
    # 3. Sample
    if getattr(trx_count_resp, 'count', 0) > 0:
        sample = (
            supabase.table("transactions")
            .select("id, date, total, status")
            .eq("tenant_id", tenant_id)
            .eq("status", "confirmed")
            .limit(1)
            .execute()
        )
        print(f"Sample Transaction: {sample.data}")
    else:
        # Check if there are ANY transactions at all
        any_trx = supabase.table("transactions").select("id, status, date", count="exact").limit(5).execute()
        print(f"Total Transactions in DB (Any date/status): {getattr(any_trx, 'count', 0)}")
        if any_trx.data:
            print(f"Sample data from DB: {any_trx.data}")

if __name__ == "__main__":
    asyncio.run(cek_data_async())
