"""Diagnose the latest transaction and current product states"""
import os, json, httpx
from dotenv import load_dotenv

load_dotenv('C:/folder fix/backend/.env')
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
tenant_id = 'd6014971-0d73-41a0-9319-dcf48e13a2d0'

# 1. Latest 3 transactions + their items
trxs = httpx.get(f'{url}/rest/v1/transactions?tenant_id=eq.{tenant_id}&order=created_at.desc&limit=3', headers=headers).json()
tx_detail = []
for t in trxs:
    items = httpx.get(f'{url}/rest/v1/transaction_items?transaction_id=eq.{t["id"]}', headers=headers).json()
    tx_detail.append({
        "id": t["id"],
        "status": t.get("status"),
        "source": t.get("source"),
        "created": t.get("created_at"),
        "items": [{"name": i.get("product_name"), "product_id": i.get("product_id"), "qty": i.get("qty"), "unit": i.get("unit")} for i in items]
    })

# 2. All active bahan_baku products
prods = httpx.get(f'{url}/rest/v1/products?tenant_id=eq.{tenant_id}&select=id,name,is_active,category,stock_qty,conversion_factor&category=eq.bahan_baku&order=name', headers=headers).json()

# 3. Recent stock_history
hist = httpx.get(f'{url}/rest/v1/stock_history?tenant_id=eq.{tenant_id}&order=created_at.desc&limit=5', headers=headers).json()

output = {
    "transactions": tx_detail,
    "bahan_baku_products": [{"id": p["id"][:8], "name": p["name"], "active": p["is_active"], "stock": p["stock_qty"], "factor": p["conversion_factor"]} for p in prods],
    "recent_history": [{"product_id": h["product_id"][:8], "change": h["change_qty"], "balance": h["balance_after"], "reason": h["reason"], "created": h["created_at"]} for h in hist]
}
with open('/tmp/diag2.json', 'w') as f:
    json.dump(output, f, indent=2)
print("Done")
