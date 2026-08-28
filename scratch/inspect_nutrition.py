import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(os.path.join("backend", ".env"))

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

if not url or not key:
    print("No SUPABASE_URL or SUPABASE_SERVICE_KEY found in backend/.env")
    exit(1)

supabase: Client = create_client(url, key)

try:
    # 1. Total count
    r = supabase.table("nutrition_ref").select("id", count="exact").limit(1).execute()
    print(f"Total rows in nutrition_ref: {r.count}")
    
    # 2. Count by data_source
    r = supabase.table("nutrition_ref").select("data_source").execute()
    sources = {}
    for item in r.data:
        ds = item.get("data_source")
        sources[ds] = sources.get(ds, 0) + 1
    print("Rows by data_source:")
    for ds, cnt in sources.items():
        print(f"  - {ds}: {cnt}")
        
    # 3. Check for 'susu'
    r = supabase.table("nutrition_ref").select("*").ilike("name", "%susu%").limit(20).execute()
    print("\nSome 'susu' items:")
    for row in r.data:
        print(f"  - {row.get('name')}: {row}")
        
except Exception as e:
    print(f"Error: {e}")
