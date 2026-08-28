import httpx
from core.config import settings

def get_schema():
    url = f"{settings.supabase_url}/rest/v1/"
    headers = {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}"
    }
    r = httpx.get(url, headers=headers)
    schema = r.json()
    
    with open("schema_tenants.txt", "w", encoding="utf-8") as f:
        for tbl in ["tenants"]:
            props = schema["definitions"].get(tbl, {}).get("properties", {})
            f.write(f"Columns in {tbl}:\n")
            for k in props.keys():
                f.write(f" - {k}\n")

if __name__ == "__main__":
    get_schema()
