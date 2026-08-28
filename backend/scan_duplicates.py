"""
1. Scan ALL duplicate products per tenant (same name, different ID)
2. Show nutrition_ref mapping status  
3. Auto-merge duplicates
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from collections import defaultdict
from supabase import create_client

sb = create_client(
    "https://thbznpozqvgmcasjmvif.supabase.co",
    "sb_secret_5urhgLXj9-5jCu-hNHgHRg_OcKV-zDx"
)

TENANT_ID = "d6014971-0d73-41a0-9319-dcf48e13a2d0"

# ========== PART 1: Find ALL duplicates ==========
print("=" * 60)
print("PART 1: SCANNING FOR DUPLICATE PRODUCTS")
print("=" * 60)

resp = sb.table("products").select("id, name, stock_qty, unit, category, nutrition_ref_id").eq("tenant_id", TENANT_ID).execute()
products = resp.data or []

# Group by normalized name (lowercase, stripped)
by_name = defaultdict(list)
for p in products:
    key = (p["name"] or "").strip().lower()
    by_name[key].append(p)

duplicates = {k: v for k, v in by_name.items() if len(v) > 1}

if not duplicates:
    print("  No duplicates found!")
else:
    print(f"  Found {len(duplicates)} duplicate groups:")
    for name, dupes in duplicates.items():
        print(f"\n  '{name}' ({len(dupes)} entries):")
        for d in dupes:
            print(f"    ID: {d['id'][:12]}...  stock={d['stock_qty']}  unit={d['unit']}  nutrition_ref={d.get('nutrition_ref_id', 'None')}")

# ========== PART 2: Check nutrition_ref mapping ==========
print("\n" + "=" * 60)
print("PART 2: NUTRITION REFERENCE MAPPING STATUS")
print("=" * 60)

# Get all nutrition_ref entries
nut_resp = sb.table("nutrition_ref").select("id, name").execute()
nut_refs = {n["name"].strip().lower(): n for n in (nut_resp.data or [])}

unmapped = []
mismatched = []
mapped_ok = []

for p in products:
    pname = (p["name"] or "").strip().lower()
    nrid = p.get("nutrition_ref_id")
    
    if not nrid:
        # Check if there's a matching nutrition_ref by name
        if pname in nut_refs:
            unmapped.append((p, nut_refs[pname]))
        # else: no nutrition ref exists, that's OK for non-food items
    else:
        # Verify the linked ref name matches
        ref_resp = sb.table("nutrition_ref").select("id, name").eq("id", nrid).execute()
        ref = (ref_resp.data or [{}])[0] if ref_resp.data else {}
        ref_name = (ref.get("name") or "").strip().lower()
        if ref_name and ref_name != pname:
            mismatched.append((p, ref))
        else:
            mapped_ok.append(p)

print(f"\n  Total products: {len(products)}")
print(f"  Mapped OK: {len(mapped_ok)}")
print(f"  Unmapped (has matching nutrition_ref by name): {len(unmapped)}")
print(f"  Mismatched name (product vs nutrition_ref): {len(mismatched)}")

if unmapped:
    print("\n  UNMAPPED products that CAN be auto-linked:")
    for p, nref in unmapped:
        print(f"    '{p['name']}' -> nutrition_ref '{nref['name']}' (id={nref['id'][:12]}...)")

if mismatched:
    print("\n  MISMATCHED names:")
    for p, ref in mismatched:
        print(f"    Product '{p['name']}' linked to nutrition_ref '{ref.get('name', '?')}'")

# ========== PART 3: Show all nutrition_ref names ==========
print("\n" + "=" * 60)
print("PART 3: ALL NUTRITION_REF ENTRIES")
print("=" * 60)
for name, nref in sorted(nut_refs.items()):
    # Check if any product uses this name
    in_products = name in by_name
    status = "OK" if in_products else "NO PRODUCT"
    print(f"  {status:12s} | {nref['name']}")

print(f"\n  Total nutrition_ref entries: {len(nut_refs)}")
print(f"  Matched to products: {sum(1 for n in nut_refs if n in by_name)}")
print(f"  Orphaned (no product): {sum(1 for n in nut_refs if n not in by_name)}")
