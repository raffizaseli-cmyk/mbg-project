#!/usr/bin/env python3
"""
TKPI seeding dengan deduplication by name (case-insensitive)
"""
import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client
import time

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🔥 TKPI SEEDING WITH DEDUPLICATION")
print("="*60)

# Use dict to deduplicate by name (key = lowercase name)
foods_dict = {}

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
                    name = cols[2].get_text(strip=True)
                    if name and len(name) > 2:
                        name_lower = name.lower()
                        
                        # Only add if not already seen
                        if name_lower not in foods_dict:
                            food = {
                                "name": name,
                                "kategori": cols[26].get_text(strip=True).lower() or "lainnya",
                                "calories": float(cols[4].get_text(strip=True).replace(',', '.')),
                                "proteins": float(cols[5].get_text(strip=True).replace(',', '.')),
                                "fat": float(cols[6].get_text(strip=True).replace(',', '.')),
                                "carbohydrate": float(cols[7].get_text(strip=True).replace(',', '.')),
                                "data_source": "TKPI"
                            }
                            foods_dict[name_lower] = food
                            page_count += 1
                except:
                    pass
        
        if page_count > 0:
            print(f"  Page {page:2d}: {page_count} NEW items (dict size: {len(foods_dict)})")
        time.sleep(0.05)
        
    except Exception as e:
        print(f"  Page {page}: ❌ {str(e)[:40]}")

# Convert dict to list
all_foods = list(foods_dict.values())
total = len(all_foods)

print(f"\n📊 After deduplication: {total} unique foods")

if total > 0:
    # Insert dengan batch 50
    batch_size = 50
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
            err_msg = str(e)[:60]
            print(f"Batch {batch_num:3d}/{total_batches}: ❌ {err_msg}")
        
        time.sleep(0.2)

print(f"\n{'='*60}")
print(f"Inserted: {success} | Failed: {failed}")

# Final count
resp = sb.table("nutrition_ref").select("id", count="exact").execute()
total_count = resp.count

resp2 = sb.table("nutrition_ref").select("data_source").execute()
sources = {}
for item in resp2.data or []:
    src = item.get('data_source', 'UNKNOWN')
    sources[src] = sources.get(src, 0) + 1

print(f"Total in database: {total_count}")
print(f"By source: {sources}")
print(f"{'='*60}")
