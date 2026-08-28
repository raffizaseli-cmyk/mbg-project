import os
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join("backend", ".env"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

client = httpx.Client(timeout=30)
try:
    resp = client.get(
        f"{SUPABASE_URL}/rest/v1/products",
        headers=headers,
        params={"select": "id,name", "limit": "20"},
    )
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"[ERROR] Error: {e}")
