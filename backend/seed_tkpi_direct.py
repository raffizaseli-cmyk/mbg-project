#!/usr/bin/env python3
"""
Quick insert TKPI data dengan batch super kecil (5 items) 
untuk avoid timeout
"""
import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Fetching TKPI data dari page 1-15...")

all_foods = []

# Fetch halaman 1-15 (skip 30 halaman yang lama)
for page in range(1, 16):  # 15 pages = ~1410 items
    url = f"https://www.andrafarm.com/_andra.php?_i=daftar-tkpi&page={page}"
    try:
        resp = requests.get(url, timeout=10)
        soup = BeautifulSoup(resp.content, 'html.parser')
        rows = soup.find_all('tr')[1:]  # Skip header
        
        for row in rows:
            cols = row.find_all(['td', 'th'])
            if len(cols) >= 28:
                try:
                    food = {
                        "name": cols[2].get_text(strip=True),
                        "kategori": cols[26].get_text(strip=True).lower() or "lainnya",
                        "calories": float(cols[4].get_text(strip=True).replace(',', '.')),
                        "proteins": float(cols[5].get_text(strip=True).replace(',', '.')),
                        "fat": float(cols[6].get_text(strip=True).replace(',', '.')),
                        "carbohydrate": float(cols[7].get_text(strip=True).replace(',', '.')),
                        "data_source": "TKPI_DIRECT"
                    }
                    if food["name"] and len(food["name"]) > 2:
                        all_foods.append(food)
                except:
                    pass
        
        print(f"  Page {page}: {len(rows)} rows parsed")
    except Exception as e:
        print(f"  Page {page}: Error - {str(e)[:50]}")

total = len(all_foods)
print(f"\nExtracted {total} foods total")

if total > 0:
    # Insert dengan batch kecil (5 items)
    batch_size = 5
    success = 0
    failed = 0
    
    print(f"Inserting dengan batch size {batch_size}...\n")
    
    for i in range(0, total, batch_size):
        chunk = all_foods[i:i+batch_size]
        batch_num = i // batch_size + 1
        
        try:
            response = sb.table("nutrition_ref").insert(chunk).execute()
            success += len(chunk)
            print(f"Batch {batch_num}: ✅ {len(chunk)} items")
        except Exception as e:
            failed += len(chunk)
            print(f"Batch {batch_num}: ❌ {str(e)[:60]}")

print(f"\nFinal: Inserted {success}, Failed {failed}")

# Verify
resp = sb.table("nutrition_ref").select("id", count="exact").execute()
print(f"Total in database: {resp.count}")
