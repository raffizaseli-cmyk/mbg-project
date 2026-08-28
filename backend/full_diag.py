"""Full database diagnostic for stock system"""
import os, json, httpx
from dotenv import load_dotenv

load_dotenv('C:/folder fix/backend/.env')
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
tenant_id = 'd6014971-0d73-41a0-9319-dcf48e13a2d0'

# 1. All products with full detail
prods = httpx.get(
    f'{url}/rest/v1/products?tenant_id=eq.{tenant_id}&order=name.asc',
    headers=headers
).json()

# 2. Recent stock history (last 5)
hist = httpx.get(
    f'{url}/rest/v1/stock_history?tenant_id=eq.{tenant_id}&order=created_at.desc&limit=10',
    headers=headers
).json()

# 3. Recent transactions (last 3)
trx = httpx.get(
    f'{url}/rest/v1/transactions?tenant_id=eq.{tenant_id}&order=created_at.desc&limit=3',
    headers=headers
).json()

output = {
    "total_products": len(prods),
    "products": [
        {
            "id": p['id'],
            "name": p.get('name'),
            "category": p.get('category'),
            "unit": p.get('unit'),
            "base_unit": p.get('base_unit'),
            "display_unit": p.get('display_unit'),
            "conversion_factor": p.get('conversion_factor'),
            "stock_qty": p.get('stock_qty'),
            "stock_min": p.get('stock_min'),
            "hpp": p.get('hpp'),
            "is_active": p.get('is_active'),
        }
        for p in prods
    ],
    "recent_history": [
        {
            "product_id": h.get('product_id'),
            "change_qty": h.get('change_qty'),
            "balance_after": h.get('balance_after'),
            "reason": h.get('reason'),
            "notes": h.get('notes'),
            "created_at": h.get('created_at'),
        }
        for h in hist
    ],
    "recent_transactions": [
        {
            "id": t['id'],
            "status": t.get('status'),
            "source": t.get('source'),
            "total": t.get('total'),
            "created_at": t.get('created_at'),
        }
        for t in trx
    ],
}

with open('/tmp/full_diag.json', 'w') as f:
    json.dump(output, f, indent=2)
print("Done")
