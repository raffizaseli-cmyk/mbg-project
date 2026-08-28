import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(os.path.join("backend", ".env"))

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

if not url or not key:
    print("No SUPABASE_URL or SUPABASE_SERVICE_KEY")
    exit(1)

supabase: Client = create_client(url, key)

for table in ["master_ingredients", "nutrition_aliases", "products", "recipes"]:
    try:
        r = supabase.table(table).select("id", count="exact").limit(1).execute()
        print(f"Table '{table}': {r.count} rows")
    except Exception as e:
        print(f"Table '{table}' error: {str(e)[:100]}")
