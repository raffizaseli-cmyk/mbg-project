"""
Script one-time untuk menghubungkan semua produk bahan_baku
ke nutrition_ref via fuzzy matching nama.

Jalankan: python backend/scripts/link_nutrition.py
"""

import os
import sys

# Ensure backend dir is in path
_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, _BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(_BACKEND_DIR, ".env"))

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_KEY not set in backend/.env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def fuzzy_match(product_name: str):
    """Try trigram matching first, fallback to ILIKE prefix search."""
    try:
        resp = sb.rpc("match_nutrition_trgm", {"search_term": product_name}).execute()
        matches = getattr(resp, "data", [])
        if matches and float(matches[0].get("similarity", 0)) > 0.3:
            return matches[0]["id"]
    except Exception as e:
        # RPC might not exist — fallback to ILIKE
        pass
    
    # Fallback: exact-ish ILIKE match
    try:
        name_lower = product_name.strip().lower()
        resp = sb.table("nutrition_ref").select("id, name").ilike("name", f"%{name_lower}%").limit(5).execute()
        rows = getattr(resp, "data", [])
        
        # Find best match (prefer exact)
        for r in rows:
            if r["name"].lower().strip() == name_lower:
                return r["id"]
        
        # Accept first partial match
        if rows:
            return rows[0]["id"]
    except Exception:
        pass
    
    return None


def main():
    # Fetch all bahan_baku products without nutrition_ref_id
    resp = sb.table("products").select("id, name, unit, nutrition_ref_id, conversion_factor").eq("category", "bahan_baku").is_("nutrition_ref_id", "null").execute()
    products = getattr(resp, "data", [])
    
    print(f"Found {len(products)} products without nutrition_ref_id")
    
    linked = 0
    not_found = []
    
    for p in products:
        pid = p["id"]
        name = p["name"]
        
        nut_id = fuzzy_match(name)
        
        if nut_id:
            update = {"nutrition_ref_id": nut_id}
            sb.table("products").update(update).eq("id", pid).execute()
            print(f"  [OK] {name} -> nutrition_ref #{nut_id}")
            linked += 1
        else:
            not_found.append(name)
            print(f"  [--] {name} -- tidak ditemukan match")
    
    print(f"\n=== HASIL ===")
    print(f"Linked: {linked}/{len(products)}")
    if not_found:
        print(f"Tidak ditemukan ({len(not_found)}):")
        for n in not_found:
            print(f"  - {n}")


if __name__ == "__main__":
    main()
