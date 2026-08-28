import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.database import get_supabase
from core.config import settings

async def cek_stock():
    supabase = get_supabase()
    
    t_resp = supabase.table("tenants").select("id, name").limit(1).execute()
    if not t_resp.data:
        print("No tenants found!")
        return
    tenant_id = t_resp.data[0]["id"]
    
    resp = (
        supabase.table("products")
        .select("name, unit, base_unit, display_unit, conversion_factor, stock_qty, stock_min")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    for p in resp.data:
        print(f"{p['name']}: {p['stock_qty']} (unit={p.get('unit')}, base={p.get('base_unit')}, display={p.get('display_unit')}, factor={p.get('conversion_factor')})")

if __name__ == "__main__":
    asyncio.run(cek_stock())
