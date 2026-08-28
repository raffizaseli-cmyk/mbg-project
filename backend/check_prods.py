import os, httpx, json
from dotenv import load_dotenv

load_dotenv('C:/folder fix/backend/.env')
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
tenant_id = 'd6014971-0d73-41a0-9319-dcf48e13a2d0'

prods = httpx.get(f'{url}/rest/v1/products?tenant_id=eq.{tenant_id}', headers=headers).json()
print('Total products:', len(prods))
for p in prods:
    print(f"Product: {p.get('name')} | is_active={p.get('is_active')} | category={p.get('category')} | hpp={p.get('hpp')} | factor={p.get('conversion_factor')} | stock={p.get('stock_qty')}")
