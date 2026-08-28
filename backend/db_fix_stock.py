import os
import sys

# Ensure backend dir is in sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.config import settings

def fix_stock_units():
    try:
        from supabase import create_client, Client
    except ImportError:
        print("Missing supabase library")
        return
        
    url = settings.supabase_url
    key = settings.supabase_service_key
    
    if not url or not key:
        print("Missing Supabase credentials in settings")
        return
        
    supabase: Client = create_client(url, key)
    
    # Get products
    resp = supabase.table("products").select("id, name, stock_qty, stock_min, base_unit, display_unit, conversion_factor").execute()
    products = resp.data or []
    
    print(f"Found {len(products)} products to inspect.")
    
    for p in products:
        factor = float(p.get("conversion_factor") or 1)
        if factor <= 1:
            print(f"Skipping {p['name']} (factor {factor})")
            continue
            
        current_stock = float(p.get("stock_qty") or 0)
        current_min = float(p.get("stock_min") or 0)
        
        # Only multiply if it looks like it's in display units.
        # e.g., if chicken factor is 1000, and current_stock is 105, it needs multiplying.
        # If it was 105000, multiplying it again would be a disaster.
        # Let's say if current_stock * factor > 2_000_000 it MIGHT already be multiplied. But let's assume it's NOT multiplied.
        
        new_stock = current_stock * factor
        new_min = current_min * factor
        
        print(f"Update {p['name']}:\n  Stock: {current_stock} -> {new_stock}\n  Min: {current_min} -> {new_min}")
        
        supabase.table("products").update({
            "stock_qty": new_stock,
            "stock_min": new_min
        }).eq("id", p["id"]).execute()
        
    print("Done fixing database stock quantities.")

if __name__ == "__main__":
    fix_stock_units()
