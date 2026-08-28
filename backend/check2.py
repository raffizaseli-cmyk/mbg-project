import os, json, httpx
from dotenv import load_dotenv

load_dotenv('C:/folder fix/backend/.env')
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
tenant_id = 'd6014971-0d73-41a0-9319-dcf48e13a2d0'

prods = httpx.get(f'{url}/rest/v1/products?tenant_id=eq.{tenant_id}', headers=headers).json()
mapped = []
for p in prods:
    mapped.append(f"{p.get('name')} | act={p.get('is_active')} | cat={p.get('category')} | hpp={p.get('hpp')} | fac={p.get('conversion_factor')}")
with open('/tmp/prods_parsed.json', 'w') as f:
    json.dump({'Total': len(prods), 'List': mapped}, f, indent=2)
