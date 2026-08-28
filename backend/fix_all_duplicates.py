"""
Auto-merge ALL remaining duplicate products for tenant.
For each duplicate group: keep the one with more stock, merge the other(s).
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from collections import defaultdict
from supabase import create_client

sb = create_client(
    "https://thbznpozqvgmcasjmvif.supabase.co",
    "sb_secret_5urhgLXj9-5jCu-hNHgHRg_OcKV-zDx"
)
TENANT = "d6014971-0d73-41a0-9319-dcf48e13a2d0"

resp = sb.table("products").select("id, name, stock_qty, unit, category, nutrition_ref_id").eq("tenant_id", TENANT).execute()
products = resp.data or []

by_name = defaultdict(list)
for p in products:
    key = (p["name"] or "").strip().lower()
    by_name[key].append(p)

dups = {k: v for k, v in by_name.items() if len(v) > 1}

FK_TABLES = [
    ("recipes", "ingredient_id"),
    ("recipe_component_items", "ingredient_id"),
    ("stock_history", "product_id"),
    ("price_history", "product_id"),
    ("mbg_weekly_menus", "menu_id"),
    ("transaction_items", "product_id"),
]

def merge_product(keep_id, remove_id, old_stock):
    """Migrate all FK references from remove_id to keep_id, then delete remove_id."""
    # 1. Merge stock
    if old_stock > 0:
        print(f"    Adding stock {old_stock} to keep product")
        sb.rpc("increment_stock", {
            "p_product_id": keep_id,
            "p_delta": old_stock,
            "p_tenant_id": TENANT,
        }).execute()

    # 2. Migrate all FK references
    for table, col in FK_TABLES:
        try:
            check = sb.table(table).select("id").eq(col, remove_id).execute()
            rows = check.data or []
            if rows:
                print(f"    {table}.{col}: {len(rows)} rows -> migrating")
                # For recipes, check for conflicts (same menu_id + ingredient_id)
                if table == "recipes" and col == "ingredient_id":
                    for r in rows:
                        rid = r["id"]
                        r_detail = sb.table("recipes").select("menu_id").eq("id", rid).execute()
                        menu_id = (r_detail.data or [{}])[0].get("menu_id")
                        if menu_id:
                            existing = sb.table("recipes").select("id").eq("menu_id", menu_id).eq("ingredient_id", keep_id).execute()
                            if existing.data:
                                print(f"      Deleting duplicate recipe {rid} (keep already has entry)")
                                sb.table("recipes").delete().eq("id", rid).execute()
                                continue
                        sb.table("recipes").update({"ingredient_id": keep_id}).eq("id", rid).execute()
                else:
                    sb.table(table).update({col: keep_id}).eq(col, remove_id).execute()
        except Exception as e:
            if "PGRST205" in str(e):  # table doesn't exist
                pass
            else:
                print(f"    WARNING: {table}.{col} error: {e}")

    # 3. Delete duplicate
    print(f"    Deleting duplicate {remove_id[:12]}...")
    try:
        sb.table("products").delete().eq("id", remove_id).execute()
        print(f"    DONE")
    except Exception as e:
        print(f"    DELETE FAILED: {e}")


for name, dupes in dups.items():
    print(f"\nMerging '{name}' ({len(dupes)} entries):")
    # Keep the one with more stock, or the one with nutrition_ref_id
    dupes.sort(key=lambda x: (bool(x.get("nutrition_ref_id")), float(x["stock_qty"])), reverse=True)
    keep = dupes[0]
    print(f"  KEEP: {keep['id'][:12]}  stock={keep['stock_qty']}  nut_ref={bool(keep.get('nutrition_ref_id'))}")
    
    for rm in dupes[1:]:
        print(f"  REMOVE: {rm['id'][:12]}  stock={rm['stock_qty']}")
        merge_product(keep["id"], rm["id"], float(rm["stock_qty"]))

# Verify
print("\n" + "=" * 50)
resp2 = sb.table("products").select("id, name, stock_qty").eq("tenant_id", TENANT).execute()
by_name2 = defaultdict(list)
for p in (resp2.data or []):
    by_name2[p["name"].strip().lower()].append(p)
remaining_dups = {k: v for k, v in by_name2.items() if len(v) > 1}
print(f"Remaining duplicates: {len(remaining_dups)}")
if remaining_dups:
    for k, v in remaining_dups.items():
        print(f"  Still dup: '{k}' x{len(v)}")
else:
    print("ALL DUPLICATES RESOLVED!")
