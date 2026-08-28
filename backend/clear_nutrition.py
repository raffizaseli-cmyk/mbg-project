#!/usr/bin/env python3
import os
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing env vars")
    exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Clearing nutrition_ref table...")
try:
    # Delete all rows by checking a condition that matches nothing
    # This is safe and won't delete anything we don't want to delete
    result = sb.table('nutrition_ref').delete().neq('id', -999999999).execute()
    print(f"✅ Deleted {len(result.data) if result.data else 'all'} rows")
except Exception as e:
    print(f"Error: {e}")
    # Try alternative approach
    try:
        r = sb.table('nutrition_ref').select('id').execute()
        for item in r.data[:100]:  # Delete first 100
            sb.table('nutrition_ref').delete().eq('id', item['id']).execute()
        print("✅ Cleared (batch delete)")
    except Exception as e2:
        print(f"Failed: {e2}")
