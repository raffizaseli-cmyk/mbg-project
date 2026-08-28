#!/usr/bin/env python3
"""
TKPI Nutrition Database Scraper v3
Optimized for reliability: tiny batches + file logging + exponential backoff
"""

import os
import time
import requests
from bs4 import BeautifulSoup
from supabase import create_client
from datetime import datetime

# ────────────────────────────────────────
# Configuration
# ────────────────────────────────────────
TKPI_URL = "https://www.andrafarm.com/_andra.php?_i=daftar-tkpi"
TKPI_MAX_PAGES = 30
BATCH_SIZE = 10  # REDUCED: 10 items per batch for stability
CHUNK_DELAY = 0.5  # seconds between batches
LOG_FILE = "scrape_log_v3.txt"

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

def log(msg):
    """Write to both console and log file immediately"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    full_msg = f"[{timestamp}] {msg}"
    print(full_msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(full_msg + "\n")
    return full_msg

# ────────────────────────────────────────
# STEP 1: Initialize
# ────────────────────────────────────────
log("=" * 70)
log("[TKPI v3] PAGINATION SCRAPER WITH FILE LOGGING")
log("=" * 70)
log(f"Target: {TKPI_URL}")
log(f"Pages: 1-{TKPI_MAX_PAGES}")
log(f"Batch Size: {BATCH_SIZE}")

if not SUPABASE_URL or not SUPABASE_KEY:
    log("ERROR: Missing SUPABASE_URL or SUPABASE_KEY")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
log(f"Supabase: Connected to {SUPABASE_URL[:50]}...")

# ────────────────────────────────────────
# STEP 2: Fetch & Parse ALL Pages
# ────────────────────────────────────────
log("\n[STEP 1] Fetching & parsing 30 pages of TKPI...")
data_batch = []
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

for page_num in range(1, TKPI_MAX_PAGES + 1):
    page_url = f"{TKPI_URL}&page={page_num}" if page_num > 1 else TKPI_URL
    
    try:
        resp = requests.get(page_url, headers=headers, timeout=10)
        resp.raise_for_status()
        
        soup = BeautifulSoup(resp.content, "html.parser")
        rows = soup.find_all("tr")[1:]  # Skip header
        
        page_items = 0
        for row in rows:
            cols = row.find_all("td")
            if len(cols) < 6:
                continue
            
            try:
                item = {
                    "name": cols[0].get_text(strip=True),
                    "kategori": cols[1].get_text(strip=True),
                    "calories": float(cols[2].get_text(strip=True).replace(",", ".")),
                    "proteins": float(cols[3].get_text(strip=True).replace(",", ".")),
                    "fat": float(cols[4].get_text(strip=True).replace(",", ".")),
                    "carbohydrate": float(cols[5].get_text(strip=True).replace(",", ".")),
                    "data_source": "TKPI"
                }
                data_batch.append(item)
                page_items += 1
            except (ValueError, IndexError):
                continue
        
        log(f"  Page {page_num:2d}: {page_items} items")
        time.sleep(0.2)  # Politeness delay
        
    except Exception as e:
        log(f"  Page {page_num:2d}: ERROR - {str(e)[:50]}")
        continue

total_data = len(data_batch)
log(f"\n[SUMMARY] Extracted: {total_data} items total\n")

if total_data == 0:
    log("ERROR: No data extracted!")
    exit(1)

# ────────────────────────────────────────
# STEP 3: Insert with Exponential Backoff
# ────────────────────────────────────────
log("[STEP 2] Inserting to Supabase (batch size: 10)...")
log("")

success_count = 0
error_count = 0
total_batches = (total_data + BATCH_SIZE - 1) // BATCH_SIZE

for batch_num in range(total_batches):
    start_idx = batch_num * BATCH_SIZE
    end_idx = min(start_idx + BATCH_SIZE, total_data)
    chunk = data_batch[start_idx:end_idx]
    
    display_batch = batch_num + 1
    first_item = chunk[0].get("name", "?")[:25]
    
    log(f"  Batch {display_batch}/{total_batches}: {len(chunk)} items (first: {first_item}...)", )
    
    # Try with exponential backoff
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = supabase.table("nutrition_ref").upsert(chunk).execute()
            success_count += len(chunk)
            log(f"    -> SUCCESS")
            break
            
        except Exception as e:
            error_msg = str(e)[:100]
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                log(f"    -> RETRY {attempt + 1}/{max_retries - 1} (wait {wait_time}s): {error_msg}")
                time.sleep(wait_time)
            else:
                log(f"    -> FAILED after {max_retries} attempts: {error_msg}")
                error_count += len(chunk)
    
    time.sleep(CHUNK_DELAY)

# ────────────────────────────────────────
# STEP 4: Verify
# ────────────────────────────────────────
log("\n[STEP 3] Final verification...")
try:
    resp = supabase.table("nutrition_ref").select("id", count="exact").execute()
    final_count = resp.count
    log(f"  Final row count in database: {final_count}")
except Exception as e:
    log(f"  ERROR checking final count: {str(e)[:100]}")
    final_count = "UNKNOWN"

log("")
log("=" * 70)
log(f"[DONE] Success: {success_count} | Errors: {error_count} | DB Total: {final_count}")
log("=" * 70)
