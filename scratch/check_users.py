import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv("backend/.env")

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Supabase credentials not found in backend/.env")
    exit(1)

supabase: Client = create_client(url, key)

print("=" * 60)
print("1. DAFTAR PENGGUNA DI TABEL PUBLIC.USERS")
print("=" * 60)

try:
    resp = supabase.table("users").select("id, email, name, role, tenant_id, is_active, created_at").order("created_at", desc=True).execute()
    users = resp.data or []
    
    t_resp = supabase.table("tenants").select("id, name").execute()
    tenant_map = {t["id"]: t["name"] for t in (t_resp.data or [])}
    
    print(f"{'No':<3} | {'Email':<30} | {'Nama':<20} | {'Role':<10} | {'Catering/Tenant':<25} | {'Aktif':<6} | {'Tgl Daftar'}")
    print("-" * 125)
    for i, u in enumerate(users, 1):
        email = u.get("email") or "-"
        name = u.get("name") or "-"
        role = u.get("role") or "-"
        t_name = tenant_map.get(u.get("tenant_id")) or u.get("tenant_id") or "-"
        aktif = "Ya" if u.get("is_active") else "Tidak"
        created = (u.get("created_at") or "")[:10]
        print(f"{i:<3} | {email:<30} | {name:<20} | {role:<10} | {t_name:<25} | {aktif:<6} | {created}")
except Exception as e:
    print(f"Error query public.users: {e}")

print("\n" + "=" * 60)
print("2. DAFTAR PENGGUNA DI SUPABASE AUTH (auth.users)")
print("=" * 60)

try:
    auth_users = supabase.auth.admin.list_users()
    user_list = []
    if hasattr(auth_users, "users"):
        user_list = auth_users.users
    elif isinstance(auth_users, list):
        user_list = auth_users
    else:
        user_list = getattr(auth_users, "data", [])
    
    if not user_list:
        print("Tidak ada user di auth.users atau list kosong.")
    else:
        for i, u in enumerate(user_list, 1):
            email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
            uid = getattr(u, "id", None) or (u.get("id") if isinstance(u, dict) else None)
            created = getattr(u, "created_at", None) or (u.get("created_at") if isinstance(u, dict) else None)
            last_sign = getattr(u, "last_sign_in_at", None) or (u.get("last_sign_in_at") if isinstance(u, dict) else None)
            print(f"{i}. Email        : {email}")
            print(f"   ID           : {uid}")
            print(f"   Created At   : {created}")
            print(f"   Last Sign In : {last_sign}")
            print("-" * 50)
except Exception as e:
    print(f"Info auth.admin: {e}")

print("\n" + "=" * 60)
print("3. DAFTAR TENANT / CATERING (public.tenants)")
print("=" * 60)
try:
    t_resp = supabase.table("tenants").select("id, name, created_at").execute()
    tenants = t_resp.data or []
    for i, t in enumerate(tenants, 1):
        print(f"{i}. Tenant Name : {t.get('name')}")
        print(f"   Tenant ID   : {t.get('id')}")
        print(f"   Dibuat      : {t.get('created_at')}")
        print("-" * 50)
except Exception as e:
    print(f"Error query public.tenants: {e}")
