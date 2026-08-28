import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from supabase import create_client

sb = create_client(
    "https://thbznpozqvgmcasjmvif.supabase.co",
    "sb_secret_5urhgLXj9-5jCu-hNHgHRg_OcKV-zDx"
)

OLD_ID = "ec8d4aba-4d9a-4b1b-9379-ed84deb06cd2"
NEW_ID = "2eeaaace-a276-4c6f-9b44-61a0c11c0635"

# Fix price_history
print("Updating price_history...")
resp = sb.table("price_history").select("id").eq("product_id", OLD_ID).execute()
rows = resp.data or []
print(f"  Found {len(rows)} rows in price_history")
if rows:
    sb.table("price_history").update({"product_id": NEW_ID}).eq("product_id", OLD_ID).execute()
    print("  Updated price_history OK")

# Now delete the old product
print(f"Deleting old product {OLD_ID}...")
try:
    sb.table("products").delete().eq("id", OLD_ID).execute()
    print("DONE - duplicate beras deleted successfully!")
except Exception as e:
    print(f"FAILED: {e}")
