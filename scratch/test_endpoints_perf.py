import time
import os
import requests
from dotenv import load_dotenv

load_dotenv("backend/.env")

BASE_URL = "http://localhost:8000"

# We need a token for tenant 038ca365
from supabase import create_client
url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(url, key)

# Get a user for login or create token
import sys
sys.path.insert(0, os.path.abspath("backend"))
from core.security import create_access_token
token = create_access_token({"sub": "user_id_test", "role": "owner", "tenant_id": "038ca365-1d37-4c31-8931-4131df351239", "email": "test@example.com"})

# But wait, backend must be running. Let's check if backend is running on 8000
headers = {"Authorization": f"Bearer {token}"}

endpoints = [
    ("/auth/me", "GET"),
    ("/reports/daily", "GET"),
    ("/reports/monthly", "GET"),
    ("/reports/stock", "GET"),
    ("/products/projection?days=7", "GET"),
    ("/transactions/unmapped-items", "GET"),
    ("/ingredients/unit-weights", "GET"),
    ("/ingredients/aliases", "GET"),
    ("/ingredients/ingredient-mappings", "GET"),
    ("/ingredients/master-ingredients", "GET"),
    ("/ingredients/master?limit=50&offset=0", "GET"),
    ("/tenants/me", "GET"),
    ("/schools", "GET"),
    ("/suppliers", "GET"),
    ("/price-tracking/overview", "GET"),
]

print(f"{'ENDPOINT':<45} | {'STATUS':<7} | {'LATENCY (ms)':<12}")
print("-" * 70)

for ep, method in endpoints:
    try:
        t0 = time.perf_counter()
        r = requests.get(f"{BASE_URL}{ep}", headers=headers, timeout=10)
        dt = (time.perf_counter() - t0) * 1000
        print(f"{ep:<45} | {r.status_code:<7} | {dt:>8.1f} ms")
    except Exception as e:
        print(f"{ep:<45} | ERROR   | {str(e)[:30]}")
