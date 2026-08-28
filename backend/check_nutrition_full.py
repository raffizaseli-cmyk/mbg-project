#!/usr/bin/env python3
import os
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing env vars")
    exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# Count total
r = sb.table('nutrition_ref').select('id').execute()
total = len(r.data) if r.data else 0
print(f"✅ nutrition_ref total rows: {total}")

# Check data sources
r2 = sb.table('nutrition_ref').select('data_source').execute()
sources = {}
for item in r2.data:
    src = item.get('data_source', 'UNKNOWN')
    sources[src] = sources.get(src, 0) + 1

print(f"\n📊 Data sources breakdown:")
for src, count in sorted(sources.items()):
    print(f"  - {src}: {count} items")
