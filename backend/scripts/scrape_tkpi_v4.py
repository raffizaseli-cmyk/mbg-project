#!/usr/bin/env python3
"""
TKPI Scraper v4 - Using Playwright for JavaScript Rendering
============================================================
Handles dynamic content loading with actual browser automation.
"""

import asyncio
import os
import sys
from datetime import datetime
from typing import List, Dict, Any
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from supabase import create_client

# ────────────────────────────────────────
# Configuration
# ────────────────────────────────────────
TKPI_URL = "https://www.andrafarm.com/_andra.php?_i=daftar-tkpi"
LOG_FILE = "scrape_tkpi_v4.log"
BATCH_SIZE = 20
CHUNK_DELAY = 1.0

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

def log(msg: str):
    """Write to console and log file"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    full_msg = f"[{timestamp}] {msg}"
    print(full_msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(full_msg + "\n")

def clean_number(value: str) -> float:
    """Parse numeric value"""
    if not value:
        return 0.0
    try:
        return float(value.replace(",", ".").strip())
    except:
        return 0.0

async def scrape_tkpi():
    """Main scraper using Playwright"""
    
    log("=" * 70)
    log("[TKPI v4] PLAYWRIGHT-BASED SCRAPER (JavaScript Rendering)")
    log("=" * 70)
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        log("ERROR: Missing SUPABASE_URL or SUPABASE_KEY")
        return False
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    log(f"Connected to Supabase: {SUPABASE_URL[:50]}...")
    
    data_batch = []
    
    # ────────────────────────────────────────
    # Step 1: Launch browser and navigate
    # ────────────────────────────────────────
    log("\n[STEP 1] Launching browser and navigating to TKPI...")
    
    async with async_playwright() as p:
        try:
            # Use chromium for better compatibility
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Navigate to TKPI page
            log(f"  Navigating to: {TKPI_URL}")
            await page.goto(TKPI_URL, wait_until="networkidle", timeout=30000)
            log("  ✅ Page loaded")
            
            # Wait for table/data to render
            log("  Waiting for data table to render...")
            await page.wait_for_timeout(3000)  # 3 sec for JS to finish
            
            # ────────────────────────────────────────
            # Step 2: Extract data from rendered HTML
            # ────────────────────────────────────────
            log("\n[STEP 2] Extracting data from rendered page...")
            
            html_content = await page.content()
            soup = BeautifulSoup(html_content, "html.parser")
            
            # Find all tables
            tables = soup.find_all("table")
            log(f"  Found {len(tables)} tables")
            
            # Parse each table for food data
            for table_idx, table in enumerate(tables):
                rows = table.find_all("tr")
                log(f"  Table {table_idx}: {len(rows)} rows")
                
                # Skip header, start from row 1
                for row_idx in range(1, len(rows)):
                    cols = rows[row_idx].find_all(["td", "th"])
                    
                    if len(cols) < 6:
                        continue
                    
                    try:
                        # Extract columns (adjust indices as needed)
                        food_name = cols[0].get_text(strip=True)
                        kategori = cols[1].get_text(strip=True) if len(cols) > 1 else "lainnya"
                        
                        if len(cols) > 5:
                            calories = clean_number(cols[2].get_text(strip=True))
                            proteins = clean_number(cols[3].get_text(strip=True))
                            fat = clean_number(cols[4].get_text(strip=True))
                            carbs = clean_number(cols[5].get_text(strip=True))
                        else:
                            continue
                        
                        # Skip empty names
                        if not food_name or len(food_name) < 2:
                            continue
                        
                        # Create item
                        item = {
                            "name": food_name,
                            "kategori": kategori.lower() or "lainnya",
                            "calories": calories,
                            "proteins": proteins,
                            "fat": fat,
                            "carbohydrate": carbs,
                            "data_source": "TKPI_Playwright"
                        }
                        
                        data_batch.append(item)
                        
                        if len(data_batch) % 100 == 0:
                            log(f"    Extracted {len(data_batch)} items...")
                            
                    except Exception as e:
                        continue
            
            await browser.close()
            
        except Exception as e:
            log(f"ERROR during scraping: {str(e)[:100]}")
            return False
    
    # ────────────────────────────────────────
    # Step 3: Insert to database
    # ────────────────────────────────────────
    total_data = len(data_batch)
    log(f"\n[STEP 3] Inserting {total_data} items to Supabase...")
    
    if total_data == 0:
        log("ERROR: No data extracted!")
        return False
    
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
        
        # Try with retry
        for attempt in range(3):
            try:
                response = supabase.table("nutrition_ref").upsert(chunk).execute()
                success_count += len(chunk)
                log(f"    -> ✅ SUCCESS")
                break
                
            except Exception as e:
                error_msg = str(e)[:80]
                if attempt < 2:
                    wait_time = 2 ** attempt
                    log(f"    -> Retry {attempt + 1}/3 (wait {wait_time}s): {error_msg}")
                    await asyncio.sleep(wait_time)
                else:
                    log(f"    -> ❌ FAILED: {error_msg}")
                    error_count += len(chunk)
        
        await asyncio.sleep(CHUNK_DELAY)
    
    # ────────────────────────────────────────
    # Step 4: Verify
    # ────────────────────────────────────────
    log("\n[STEP 4] Verifying database...")
    try:
        resp = supabase.table("nutrition_ref").select("id", count="exact").execute()
        final_count = resp.count
        log(f"  Final row count: {final_count}")
        result = final_count > 0
    except Exception as e:
        log(f"  ERROR: {str(e)[:80]}")
        result = False
    
    log("")
    log("=" * 70)
    log(f"[DONE] Extracted: {total_data} | Inserted: {success_count} | Errors: {error_count}")
    log("=" * 70)
    
    return result

# ────────────────────────────────────────
# Main
# ────────────────────────────────────────
if __name__ == "__main__":
    # Clear old log
    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)
    
    # Run async scraper
    success = asyncio.run(scrape_tkpi())
    sys.exit(0 if success else 1)
