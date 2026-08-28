import os
import sys
import httpx
from dotenv import load_dotenv

# Ensure backend dir is in sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

load_dotenv("backend/.env")

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")

def fix_stock_units():
    print("Fixing via HTTPX...")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    with httpx.Client() as client:
        resp = client.get(f"{url}/rest/v1/products", headers=headers)
        products = resp.json()
        
        print(f"Found {len(products)} products to inspect.")
        
        for p in products:
            factor = float(p.get("conversion_factor") or 1)
            if factor <= 1:
                print(f"Skipping {p['name']} (factor {factor})")
                continue
                
            current_stock = float(p.get("stock_qty") or 0)
            current_min = float(p.get("stock_min") or 0)
            
            # For logging: Ayam should have current_stock = 105, factor = 1000
            new_stock = current_stock * factor
            new_min = current_min * factor
            
            print(f"Update {p['name']}:\n  Stock: {current_stock} -> {new_stock}\n  Min: {current_min} -> {new_min}")
            
            # Perform PATCH
            patch_resp = client.patch(
                f"{url}/rest/v1/products?id=eq.{p['id']}",
                headers=headers,
                json={"stock_qty": new_stock, "stock_min": new_min}
            )
            
            if patch_resp.status_code >= 400:
                print(f"Failed to update {p['name']}: {patch_resp.text}")
            else:
                print(f"  -> Success: {p['name']}")

if __name__ == "__main__":
    fix_stock_units()
