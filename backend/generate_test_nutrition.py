#!/usr/bin/env python3
"""
Generate 1000 test nutrition items for development
"""
import os
from supabase import create_client
import time

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🧪 GENERATING 1000+ TEST NUTRITION ITEMS")
print("="*60)

categories = ["beras", "daging", "ikan", "sayuran", "buah", "susu", "telur", "minyak", "roti", "pasta"]
bases = ["Putih", "Merah", "Hitam", "Premium", "Organik", "Fresh", "Frozen", "Segar", "Kering", "Tua"]

test_items = []

# Generate items with formula: base_name_X
for i in range(1, 1001):
    cat_idx = (i - 1) % len(categories)
    base_idx = (i - 1) % len(bases)
    
    item = {
        "name": f"{bases[base_idx]} {categories[cat_idx]} #{i:04d}",
        "kategori": categories[cat_idx],
        "calories": 50 + (i % 200),
        "proteins": 2 + (i % 20),
        "fat": 1 + (i % 15),
        "carbohydrate": 5 + (i % 30),
        "data_source": "TEST_DEV"
    }
    test_items.append(item)

total = len(test_items)
print(f"Generated {total} test items")

# Insert dengan batch 100
batch_size = 100
success = 0
failed = 0

print(f"\nInserting dengan batch size {batch_size}...\n")

for i in range(0, total, batch_size):
    chunk = test_items[i:i+batch_size]
    batch_num = i // batch_size + 1
    total_batches = (total + batch_size - 1) // batch_size
    
    try:
        response = sb.table("nutrition_ref").upsert(chunk).execute()
        success += len(chunk)
        pct = int((i + len(chunk)) / total * 100)
        print(f"Batch {batch_num:3d}/{total_batches}: ✅ {len(chunk):3d} items [{pct:3d}%]")
    except Exception as e:
        failed += len(chunk)
        err_msg = str(e)[:50]
        print(f"Batch {batch_num:3d}/{total_batches}: ❌ {err_msg}")
    
    time.sleep(0.1)

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

print(f"\nTotal in database: {total_count}")
print(f"By source:")
for src, count in sorted(sources.items()):
    print(f"  {src}: {count}")
print(f"{'='*60}")
