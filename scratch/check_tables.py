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
    # Get table list using sql query if possible? No, supabase client cannot run arbitrary SQL directly.
    # Let's try to query public tables. We can call PostgreSQL catalog tables via REST if REST is exposed,
    # or we can use the supabase client to query table data.
    # Let's check what endpoints / tables we can access by trying some common tables.
    print("Checking tables...")
    for t in ["nutrition_ref", "tkpi", "nutrisi", "nutrition", "ingredients", "products", "recipes"]:
        try:
            r = supabase.table(t).select("id", count="exact").limit(1).execute()
            print(f"  - Table '{t}' exists, rows: {r.count}")
        except Exception as e:
            print(f"  - Table '{t}' does not exist or error: {str(e)[:100]}")
            
except Exception as e:
    print(f"Error: {e}")
