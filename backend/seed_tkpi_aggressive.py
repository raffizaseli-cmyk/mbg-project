#!/usr/bin/env python3
"""
Aggressive TKPI seeding - batch 20 items, all 30 pages
"""
import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client
import time

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🔥 AGGRESSIVE TKPI SEEDING - 30 pages, batch 20")
print("="*60)

all_foods = []

# Fetch all 30 pages
for page in range(1, 31):
    url = f"https://www.andrafarm.com/_andra.php?_i=daftar-tkpi&page={page}"
    try:
        resp = requests.get(url, timeout=10)
        soup = BeautifulSoup(resp.content, 'html.parser')
        rows = soup.find_all('tr')[1:]
        
        page_count = 0
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
                        "data_source": "TKPI_FULL"
                    }
                    if food["name"] and len(food["name"]) > 2:
                        all_foods.append(food)
                        page_count += 1
                except:
                    pass
        
        if page_count > 0:
            print(f"  Page {page:2d}: {page_count} items")
        time.sleep(0.1)
        
    except Exception as e:
        print(f"  Page {page}: ❌ {str(e)[:40]}")

total = len(all_foods)
print(f"\n📊 Extracted {total} foods total from all pages")

if total > 0:
    # Insert dengan batch 20
    batch_size = 20
    success = 0
    failed = 0
    
    print(f"\n🚀 Inserting dengan batch size {batch_size}...\n")
    
    for i in range(0, total, batch_size):
        chunk = all_foods[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (total + batch_size - 1) // batch_size
        
        try:
            response = sb.table("nutrition_ref").insert(chunk).execute()
            success += len(chunk)
            pct = int((i + len(chunk)) / total * 100)
            print(f"Batch {batch_num:3d}/{total_batches}: ✅ {len(chunk):2d} items [{pct:3d}%]")
        except Exception as e:
            failed += len(chunk)
            print(f"Batch {batch_num:3d}/{total_batches}: ❌ {str(e)[:40]}")
        
        time.sleep(0.2)

print(f"\n{'='*60}")
print(f"Inserted: {success} | Failed: {failed}")

# Final count
resp = sb.table("nutrition_ref").select("id", count="exact").execute()
print(f"Total in database: {resp.count} ✅")
print(f"{'='*60}")
