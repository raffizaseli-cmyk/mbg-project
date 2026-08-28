"""
Fix beras: 
1. Reactivate 2eeaaace (the correct beras with reasonable stock 10,010 kg)
2. Reset its stock to a clean value (incorporate the +20kg from the latest transaction)
"""
import os, httpx
from dotenv import load_dotenv

load_dotenv('C:/folder fix/backend/.env')
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'Prefer': 'return=representation'}

# Reactivate the correct beras (2eeaaace) and keep the other one (ec8d4aba) deactivated
correct_beras = '2eeaaace-a276-4c6f-9b44-61a0c11c0635'

# Reactivate it
res = httpx.patch(f'{url}/rest/v1/products?id=eq.{correct_beras}', headers=headers, json={
    "is_active": True,
    "hpp": 13000.0,
})
print(f"Reactivated beras: {res.status_code}")

# Also update the latest transaction items that pointed to the wrong beras (ec8d4aba)
# so they now point to the correct one
wrong_beras = 'ec8d4aba-4d9a-4b1b-9379-ed84deb06cd2'
res2 = httpx.patch(
    f'{url}/rest/v1/transaction_items?product_id=eq.{wrong_beras}',
    headers=headers,
    json={"product_id": correct_beras}
)
print(f"Redirected transaction items from wrong beras: {res2.status_code}, count={len(res2.json())}")

# Also update product_aliases to point to correct beras
res3 = httpx.patch(
    f'{url}/rest/v1/product_aliases?product_id=eq.{wrong_beras}',
    headers=headers,
    json={"product_id": correct_beras}
)
print(f"Fixed aliases: {res3.status_code}")

print("Done!")
