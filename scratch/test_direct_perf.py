import os
import sys
import time
from dotenv import load_dotenv

load_dotenv("backend/.env")
sys.path.insert(0, os.path.abspath("backend"))

from fastapi.testclient import TestClient
from main import app
from core.security import create_access_token

token = create_access_token({
    "user_id": "38f0f185-747c-4fbf-bdbf-ca5ac2987e38",
    "role": "owner",
    "tenant_id": "038ca365-781d-411f-abfc-fd2279e3f0cf",
    "email": "pramanaraffi68@gmail.com"
})

client = TestClient(app)
headers = {"Authorization": f"Bearer {token}"}

endpoints = [
    "/auth/me",
    "/reports/daily",
    "/reports/monthly",
    "/reports/stock",
    "/products/projection?days=7",
    "/transactions/unmapped-items",
    "/ingredients/unit-weights",
    "/ingredients/aliases",
    "/ingredients/ingredient-mappings",
    "/ingredients/master-ingredients",
    "/ingredients/master?limit=50&offset=0",
    "/tenants/me",
    "/schools",
    "/suppliers",
    "/price-tracking/overview",
    "/budget/summary",
]

print(f"{'ENDPOINT':<45} | {'COLD (ms)':<10} | {'WARM (ms)':<10}")
print("=" * 70)

for ep in endpoints:
    t0 = time.perf_counter()
    r1 = client.get(ep, headers=headers)
    dt1 = (time.perf_counter() - t0) * 1000

    t1 = time.perf_counter()
    r2 = client.get(ep, headers=headers)
    dt2 = (time.perf_counter() - t1) * 1000

    print(f"{ep:<45} | {dt1:>8.1f} ms | {dt2:>8.1f} ms")

print("=" * 70)
