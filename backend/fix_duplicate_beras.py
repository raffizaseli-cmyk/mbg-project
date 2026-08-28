"""
Diagnose and fix duplicate 'beras' products.
- Find all products named 'beras'
- Merge stock into the one with more stock
- Update all recipes referencing the old one
- Update all stock_history referencing the old one
- Delete the duplicate
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://thbznpozqvgmcasjmvif.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "sb_secret_5urhgLXj9-5jCu-hNHgHRg_OcKV-zDx")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# 1. Find all products named 'beras' (case-insensitive)
resp = sb.table("products").select("id, name, stock_qty, unit, tenant_id, category").ilike("name", "beras").execute()
products = resp.data or []

print(f"\n=== Found {len(products)} 'beras' products ===")
for p in products:
    print(f"  ID: {p['id']}")
    print(f"  Name: {p['name']}")
    print(f"  Stock: {p['stock_qty']} {p['unit']}")
    print(f"  Tenant: {p['tenant_id']}")
    print(f"  Category: {p['category']}")
    print()

if len(products) < 2:
    print("No duplicates found. Exiting.")
    sys.exit(0)

# Group by tenant
from collections import defaultdict
by_tenant = defaultdict(list)
for p in products:
    by_tenant[p["tenant_id"]].append(p)

for tenant_id, dupes in by_tenant.items():
    if len(dupes) < 2:
        continue
    
    print(f"\n=== Tenant {tenant_id}: {len(dupes)} duplicates ===")
    
    # Keep the one with more stock
    dupes.sort(key=lambda x: float(x["stock_qty"]), reverse=True)
    keep = dupes[0]
    remove_list = dupes[1:]
    
    print(f"  KEEP:   {keep['id']} (stock={keep['stock_qty']})")
    for rm in remove_list:
        print(f"  REMOVE: {rm['id']} (stock={rm['stock_qty']})")
    
    for rm in remove_list:
        old_id = rm["id"]
        new_id = keep["id"]
        old_stock = float(rm["stock_qty"])
        
        # 2. Check recipes referencing the old product
        recipe_resp = sb.table("recipes").select("id, menu_id, ingredient_id").eq("ingredient_id", old_id).execute()
        old_recipes = recipe_resp.data or []
        print(f"\n  Recipes referencing old ID: {len(old_recipes)}")
        
        # 3. Check recipe_component_items referencing the old product
        comp_resp = sb.table("recipe_component_items").select("id, ingredient_id").eq("ingredient_id", old_id).execute()
        old_comps = comp_resp.data or []
        print(f"  Component items referencing old ID: {len(old_comps)}")
        
        # 4. Check stock_history referencing the old product
        hist_resp = sb.table("stock_history").select("id, product_id").eq("product_id", old_id).execute()
        old_hist = hist_resp.data or []
        print(f"  Stock history entries for old ID: {len(old_hist)}")
        
        # 5. Check mbg_weekly_menus referencing the old product as menu_id
        menu_resp = sb.table("mbg_weekly_menus").select("id, menu_id").eq("menu_id", old_id).execute()
        old_menus = menu_resp.data or []
        print(f"  Weekly menus referencing old ID: {len(old_menus)}")
        
        confirm = input(f"\n  Merge stock {old_stock} into keep-product and delete old? (y/N): ")
        if confirm.lower() != "y":
            print("  Skipped.")
            continue
        
        # --- Merge stock ---
        if old_stock > 0:
            print(f"  Adding {old_stock} to keep product...")
            sb.rpc("increment_stock", {
                "p_product_id": new_id,
                "p_delta": old_stock,
                "p_tenant_id": tenant_id,
            }).execute()
        
        # --- Update recipes ---
        for r in old_recipes:
            # Check if keep product already has this recipe for same menu
            existing = sb.table("recipes").select("id").eq("menu_id", r["menu_id"]).eq("ingredient_id", new_id).execute()
            if existing.data:
                print(f"  Recipe {r['id']}: keep already has entry for menu {r['menu_id']}, deleting old")
                sb.table("recipes").delete().eq("id", r["id"]).execute()
            else:
                print(f"  Recipe {r['id']}: updating ingredient_id to {new_id}")
                sb.table("recipes").update({"ingredient_id": new_id}).eq("id", r["id"]).execute()
        
        # --- Update component items ---
        for c in old_comps:
            print(f"  Component item {c['id']}: updating ingredient_id to {new_id}")
            sb.table("recipe_component_items").update({"ingredient_id": new_id}).eq("id", c["id"]).execute()
        
        # --- Update stock history ---
        for h in old_hist:
            print(f"  Stock history {h['id']}: updating product_id to {new_id}")
            sb.table("stock_history").update({"product_id": new_id}).eq("id", h["id"]).execute()
        
        # --- Update weekly menus ---
        for m in old_menus:
            print(f"  Weekly menu {m['id']}: updating menu_id to {new_id}")
            sb.table("mbg_weekly_menus").update({"menu_id": new_id}).eq("id", m["id"]).execute()
        
        # --- Delete duplicate ---
        print(f"  Deleting duplicate product {old_id}...")
        sb.table("products").delete().eq("id", old_id).execute()
        print(f"  ✅ Done! Merged and cleaned duplicate beras.")

print("\n=== Finished ===")
