import httpx
from core.config import settings

url = f"{settings.supabase_url}/rest/v1/"
headers = {
    "apikey": settings.supabase_anon_key,
    "Authorization": f"Bearer {settings.supabase_anon_key}"
}
r = httpx.get(url, headers=headers)
schema = r.json()
print("Daftar Table di Supabase:")
for tbl in schema["definitions"].keys():
    print(f"- {tbl}")
