"""Quick scan: current duplicates + nutrition mapping status"""
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
print(f"Total products: {len(products)}")
print(f"Duplicate groups remaining: {len(dups)}")
for name, dupes in dups.items():
    print(f"  DUP: '{name}' x{len(dupes)}")
    for d in dupes:
        sid = d["id"][:12]
        print(f"    {sid}  stock={d['stock_qty']}  unit={d['unit']}")

unmapped = [p for p in products if not p.get("nutrition_ref_id")]
mapped = [p for p in products if p.get("nutrition_ref_id")]
print(f"\nMapped to nutrition_ref: {len(mapped)}")
print(f"Unmapped (no nutrition_ref_id): {len(unmapped)}")
for p in unmapped:
    print(f"  NO NUT REF: {p['name']}")

# Try to auto-link unmapped products to nutrition_ref by name
nut_resp = sb.table("nutrition_ref").select("id, name").execute()
nut_by_name = {}
for n in (nut_resp.data or []):
    nut_by_name[n["name"].strip().lower()] = n

print(f"\nAuto-linkable products:")
linkable = []
for p in unmapped:
    pname = p["name"].strip().lower()
    if pname in nut_by_name:
        nref = nut_by_name[pname]
        print(f"  '{p['name']}' -> '{nref['name']}' (ref_id={nref['id'][:12]})")
        linkable.append((p, nref))
    else:
        # Try partial match
        matches = [n for nk, n in nut_by_name.items() if pname in nk or nk in pname]
        if matches:
            print(f"  '{p['name']}' ~ partial match: '{matches[0]['name']}'")

print(f"\nExact matches that can be auto-linked: {len(linkable)}")
