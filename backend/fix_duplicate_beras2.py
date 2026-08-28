"""
Fix remaining FK references to old beras product that prevented deletion.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from supabase import create_client

SUPABASE_URL = "https://thbznpozqvgmcasjmvif.supabase.co"
SUPABASE_KEY = "sb_secret_5urhgLXj9-5jCu-hNHgHRg_OcKV-zDx"

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

OLD_ID = "ec8d4aba-4d9a-4b1b-9379-ed84deb06cd2"
NEW_ID = "2eeaaace-a276-4c6f-9b44-61a0c11c0635"

# Check all tables that might reference products
tables_to_check = [
    ("price_history", "product_id"),
    ("transaction_items", "product_id"),
    ("nutrition_mapping", "product_id"),
]

for table, col in tables_to_check:
    try:
        resp = sb.table(table).select("id").eq(col, OLD_ID).execute()
        rows = resp.data or []
        if rows:
            print(f"  {table}.{col}: {len(rows)} references → updating to new ID")
            sb.table(table).update({col: NEW_ID}).eq(col, OLD_ID).execute()
            print(f"    ✅ Updated")
        else:
            print(f"  {table}.{col}: no references")
    except Exception as e:
        print(f"  {table}.{col}: error checking - {e}")

# Now try to delete the old product
print(f"\nDeleting old product {OLD_ID}...")
try:
    sb.table("products").delete().eq("id", OLD_ID).execute()
    print("✅ Successfully deleted duplicate beras product!")
except Exception as e:
    print(f"❌ Failed: {e}")
    # Try to find any remaining FK references
    print("\nSearching for remaining references...")
    # Generic approach - try common table patterns
    more_tables = [
        ("cart_items", "product_id"),
        ("order_items", "product_id"),
        ("inventory_adjustments", "product_id"),
    ]
    for table, col in more_tables:
        try:
            resp = sb.table(table).select("id").eq(col, OLD_ID).execute()
            rows = resp.data or []
            if rows:
                print(f"  Found {len(rows)} in {table}.{col}")
        except:
            pass
