from fastapi.testclient import TestClient
from main import app
from core.dependencies import get_current_user, require_role
from models.user import UserInDB
from datetime import datetime

def override_get_current_user():
    return UserInDB(
        id="12345678-1234-5678-1234-567812345678",
        email="owner@uji-coba.local",
        tenant_id="f2c3d5e2-0fb0-482a-a9a3-a7543bbff972", # we should fetch this if possible
        role="owner",
        is_active=True,
        created_at=datetime.now()
    )

app.dependency_overrides[get_current_user] = override_get_current_user
app.dependency_overrides[require_role] = lambda *args, **kwargs: lambda: True

client = TestClient(app)

print("--- Testing POST /employees/positions ---")
res = client.post("/employees/positions", json={
    "id": "",
    "name": "Testing Jabatan",
    "salary_type": "harian",
    "base_salary": 2000
})
print("STATUS:", res.status_code)
print("BODY:", res.text)
