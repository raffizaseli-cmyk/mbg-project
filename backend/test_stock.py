import asyncio
from core.database import get_supabase
from core.config import settings

async def main():
    supabase = get_supabase()
    # Find a tenant and a product
    resp = supabase.table("products").select("id, tenant_id, name").eq("name", "beras").limit(1).execute()
    data = getattr(resp, "data", [])
    if not data:
        print("No product 'beras' found.")
        return
    
    prod = data[0]
    p_id = prod["id"]
    t_id = prod["tenant_id"]
    
    print(f"Found {prod['name']}, ID: {p_id}, Tenant: {t_id}")
    try:
        res = supabase.rpc("increment_stock", {
            "p_product_id": p_id,
            "p_delta": 10.0,
            "p_tenant_id": t_id,
        }).execute()
        print("RPC Result:", res)
    except Exception as e:
        print("RPC Error:", type(e), str(e))

if __name__ == "__main__":
    asyncio.run(main())
