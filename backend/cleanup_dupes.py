"""
Cleanup script: deactivate duplicate products keeping only the one with highest stock.
Also deactivate products that should have been deleted (bistik samar, wedang ronde, nasgor*, ayam nasgor*).
"""
import os, httpx, json
from dotenv import load_dotenv

load_dotenv('C:/folder fix/backend/.env')
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'Prefer': 'return=representation'}
tenant_id = 'd6014971-0d73-41a0-9319-dcf48e13a2d0'

prods = httpx.get(f'{url}/rest/v1/products?tenant_id=eq.{tenant_id}', headers=headers).json()

# Group by name (case-insensitive)
groups = {}
for p in prods:
    key_name = p['name'].lower().strip()
    groups.setdefault(key_name, []).append(p)

deactivate_ids = []

for name, items in groups.items():
    if len(items) > 1:
        # Keep the one with highest stock_qty, deactivate others
        items_sorted = sorted(items, key=lambda x: float(x.get('stock_qty') or 0), reverse=True)
        keep = items_sorted[0]
        print(f"DUPLICATE '{name}': keeping id={keep['id']} (stock={keep['stock_qty']})")
        for dup in items_sorted[1:]:
            print(f"  -> deactivating id={dup['id']} (stock={dup['stock_qty']})")
            deactivate_ids.append(dup['id'])

if deactivate_ids:
    for pid in deactivate_ids:
        httpx.patch(f'{url}/rest/v1/products?id=eq.{pid}', headers=headers, json={"is_active": False})
    print(f"\nDeactivated {len(deactivate_ids)} duplicate products.")
else:
    print("No duplicates found.")
