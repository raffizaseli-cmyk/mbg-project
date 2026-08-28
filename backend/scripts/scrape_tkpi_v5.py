#!/usr/bin/env python3
"""
TKPI Scraper v5 - Simple approach using requests + CSV fallback
=================================================================
Tries multiple strategies to get TKPI data:
1. Direct requests to website
2. Search for CSV export link
3. Fall back to sample data if needed
"""

import os
import sys
import requests
from bs4 import BeautifulSoup
from supabase import create_client
from datetime import datetime

LOG_FILE = "scrape_v5.log"

def log(msg):
    timestamp = datetime.now().strftime("%H:%M:%S")
    full_msg = f"[{timestamp}] {msg}"
    print(full_msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(full_msg + "\n")

def get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL, SUPABASE_KEY missing")
        exit(1)
    return create_client(url, key)

# ────────────────────────────────────────
# STRATEGY 1: Try different TKPI URLs
# ────────────────────────────────────────
log("=" * 70)
log("[TKPI v5] SIMPLE MULTI-STRATEGY SCRAPER")
log("=" * 70)

urls_to_try = [
    "https://www.andrafarm.com/_andra.php?_i=daftar-tkpi",
    "https://www.andrafarm.com/_andra.php?_i=daftar-tkpi&page=1",
    "https://www.andrafarm.com/api/tkpi",
    "https://www.andrafarm.com/data/tkpi.json",
]

log("\n[1] Trying different URLs...")

data_batch = []
for url in urls_to_try:
    try:
        log(f"  Trying: {url}")
        resp = requests.get(url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0'
        })
        
        if resp.status_code == 200:
            content_type = resp.headers.get('content-type', '')
            
            # Try JSON first
            if 'json' in content_type.lower():
                try:
                    data = resp.json()
                    if isinstance(data, list) and len(data) > 0:
                        log(f"    ✅ Got {len(data)} items from JSON")
                        data_batch = data
                        break
                except:
                    pass
            
            # Try HTML table parsing
            soup = BeautifulSoup(resp.content, 'html.parser')
            tables = soup.find_all('table')
            
            if tables:
                log(f"    Found {len(tables)} tables, checking for food data...")
                
                for table in tables:
                    rows = table.find_all('tr')[1:]  # Skip header
                    
                    for row in rows:
                        cols = row.find_all(['td', 'th'])
                        
                        if len(cols) >= 6:
                            try:
                                name = cols[0].get_text(strip=True)
                                kategori = cols[1].get_text(strip=True) if len(cols) > 1 else "lainnya"
                                
                                # Try to parse as floats
                                cal = float(cols[2].get_text(strip=True).replace(',', '.'))
                                prot = float(cols[3].get_text(strip=True).replace(',', '.'))
                                fat = float(cols[4].get_text(strip=True).replace(',', '.'))
                                carb = float(cols[5].get_text(strip=True).replace(',', '.'))
                                
                                if name and len(name) > 2:
                                    data_batch.append({
                                        "name": name,
                                        "kategori": kategori.lower() or "lainnya",
                                        "calories": cal,
                                        "proteins": prot,
                                        "fat": fat,
                                        "carbohydrate": carb,
                                        "data_source": "TKPI_v5"
                                    })
                            except:
                                pass
                
                if data_batch:
                    log(f"    ✅ Extracted {len(data_batch)} food items")
                    break
    
    except Exception as e:
        log(f"    ❌ Error: {str(e)[:50]}")

# ────────────────────────────────────────
# Result
# ────────────────────────────────────────
if data_batch:
    log(f"\n[2] Extracted {len(data_batch)} items total")
    log("\n[3] Inserting to Supabase...")
    
    sb = get_supabase()
    success_count = 0
    error_count = 0
    
    # Insert in batches
    batch_size = 50
    for i in range(0, len(data_batch), batch_size):
        chunk = data_batch[i:i+batch_size]
        try:
            response = sb.table("nutrition_ref").upsert(chunk).execute()
            success_count += len(chunk)
            log(f"  Batch {i//batch_size + 1}: ✅ {len(chunk)} items")
        except Exception as e:
            error_count += len(chunk)
            log(f"  Batch {i//batch_size + 1}: ❌ {str(e)[:50]}")
    
    # Verify
    resp = sb.table("nutrition_ref").select("id", count="exact").execute()
    log(f"\n[4] Final database count: {resp.count}")
    log("=" * 70)
    
else:
    log("\n❌ No data extracted from any source")
    log("\n[FALLBACK] Using sample data instead...")
    
    sample_foods = [
        {"name": "Nasi Putih", "kategori": "biji-bijian", "calories": 130, "proteins": 2.7, "fat": 0.3, "carbohydrate": 28, "data_source": "SAMPLE_FALLBACK"},
        {"name": "Telur Ayam", "kategori": "telur", "calories": 155, "proteins": 13.3, "fat": 11, "carbohydrate": 1.1, "data_source": "SAMPLE_FALLBACK"},
        {"name": "Ayam Tanpa Kulit", "kategori": "daging-unggas", "calories": 165, "proteins": 31, "fat": 3.6, "carbohydrate": 0, "data_source": "SAMPLE_FALLBACK"},
    ]
    
    sb = get_supabase()
    try:
        sb.table("nutrition_ref").upsert(sample_foods).execute()
        resp = sb.table("nutrition_ref").select("id", count="exact").execute()
        log(f"Fallback: Added {len(sample_foods)} items. Total: {resp.count}")
    except Exception as e:
        log(f"Fallback failed: {str(e)}")
