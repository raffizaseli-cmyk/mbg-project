import os, httpx, json
from dotenv import load_dotenv

load_dotenv('C:/folder fix/backend/.env')
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'Prefer': 'return=representation'}
tenant_id = 'd6014971-0d73-41a0-9319-dcf48e13a2d0'

res = httpx.patch(f'{url}/rest/v1/products?tenant_id=eq.{tenant_id}&is_active=eq.false', headers=headers, json={"is_active": True})
print("Updated items:", len(res.json()))
