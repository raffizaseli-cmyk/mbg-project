import os
import sys
import httpx
from datetime import timedelta
from jose import jwt

# Add backend to path
backend_dir = r"c:\Users\Lenovo\OneDrive\folder fix\backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from core.config import settings
from core.database import get_supabase

# Fetch user
supabase = get_supabase()
users_resp = supabase.table("users").select("*").eq("email", "amirulmhp@gmail.com").execute()
if not users_resp.data:
    print("User amirulmhp@gmail.com not found in DB!")
    sys.exit(1)

user_data = users_resp.data[0]
user_id = user_data["id"]
tenant_id = user_data["tenant_id"]

# Generate JWT Token using local SECRET_KEY
payload = {
    "user_id": user_id,
    "tenant_id": tenant_id
}
token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)

prod_url = "https://mbg-catering-production-4d7f.up.railway.app"
headers = {
    "Authorization": f"Bearer {token}"
}

print(f"Querying production backend: {prod_url}/api/ingredients/master")
client = httpx.Client(timeout=30)
try:
    resp = client.get(f"{prod_url}/api/ingredients/master", headers=headers)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
except Exception as e:
    print(f"Request failed: {e}")
