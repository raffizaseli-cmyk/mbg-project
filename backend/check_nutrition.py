#!/usr/bin/env python3
import os
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing env vars")
    exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
r = sb.table('nutrition_ref').select('name').limit(10).execute()
print(f"✅ nutrition_ref table has {len(r.data)} rows")
if r.data:
    for x in r.data:
        print(f"  - {x['name']}")
else:
    print("  ⚠️  Table is empty")
