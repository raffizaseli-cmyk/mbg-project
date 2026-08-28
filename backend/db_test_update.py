import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env")
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

tid = "d6014971-0d73-41a0-9319-dcf48e13a2d0"
pid = "2eeaaace-a276-4c6f-9b44-61a0c11c0635"

try:
    resp = supabase.table("products").update({"harga": "13000.00"}).eq("id", pid).eq("tenant_id", tid).execute()
    print("UPDATE RESPONSE:", resp.data)
except Exception as e:
    print("UPDATE ERROR:", e)
