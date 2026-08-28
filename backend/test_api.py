import json
from fastapi.testclient import TestClient
from main import app
from core.dependencies import get_current_user
from models.user import UserInDB
from core.database import get_supabase

def override_get_current_user():
    return UserInDB(
        id="user1", 
        tenant_id="d6014971-0d73-41a0-9319-dcf48e13a2d0",
        phone_number="123",
        role="owner",
        email="test@test.com",
        name="test name"
    )

app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

response = client.post("/mbg/weekly-menus/validate", json={"menu_name": "mbg dua"})
print("STATUS CODE:", response.status_code)
print("RESPONSE:", response.text)
