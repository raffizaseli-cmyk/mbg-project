from fastapi.testclient import TestClient
from main import app
from core.database import get_supabase
from core.dependencies import get_current_user
from models.user import UserInDB

def override_get_current_user():
    sb = get_supabase()
    res = sb.table('tenants').select('id').limit(1).execute()
    tid = res.data[0]['id']
    return UserInDB(id="test-user", email="test@test.com", role="owner", tenant_id=tid, name="Test Owner", is_active=True)

app.dependency_overrides[get_current_user] = override_get_current_user
client = TestClient(app)

print("--- EXCEL ---")
res = client.post("/legal/excel-dinas/generate", json={"year": 2026, "month": 3})
print(res.status_code, res.text)

print("--- SPT ---")
res2 = client.post("/legal/spt/generate", json={"year": 2026, "month": 3})
print(res2.status_code, res2.text)

print("--- BAP ---")
res3 = client.post("/legal/bap/generate", json={"year": 2026, "month": 3})
print(res3.status_code, res3.text)

print("--- JABATAN ---")
res4 = client.post("/employees/positions", json={"id": "", "name": "Tester", "salary_type": "harian", "base_salary": 1000})
print(res4.status_code, res4.text)
