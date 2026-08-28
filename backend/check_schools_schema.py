import asyncio
from core.database import get_supabase

supabase = get_supabase()

print("Fetching 1 row from schools table to inspect columns...")
res = supabase.table("schools").select("*").limit(1).execute()

if res.data:
    row = res.data[0]
    print(f"Columns in schools table: {list(row.keys())}")
else:
    print("Table schools is empty. Cannot infer columns from a row.")
    
    # Try inserting a dummy row then capturing the error or checking POSTGREST schema?
    # Another approach: read table schema via rpc or just guess from similar models.
