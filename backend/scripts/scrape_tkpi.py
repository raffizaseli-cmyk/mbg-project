#!/usr/bin/env python3
"""
TKPI Data Scraping & Population Script
======================================

Purpose:
  Scrape 1000+ food nutrition data from TKPI (Tabel Komposisi Pangan Indonesia)
  website and populate nutrition_ref table di Supabase.

Schema mapping:
  - Makronutrien: calories, proteins, fat, carbohydrate, fiber (kolom utama)
  - Mikronutrien + metadata: stored in custom_nutrients (JSONB)
  - Source tracking: data_source = "TKPI_" + year

Usage:
  1. Set SUPABASE_URL dan SUPABASE_KEY environment variables
  2. python scrape_tkpi.py
  3. Monitor output - tunggu semua batch selesai
  4. Run backend/scan_duplicates.py untuk verify

Dependencies:
  pip install requests beautifulsoup4 supabase python-dotenv

Author: Auto-generated for MBG Catering ERP
Date: 2026-06-19
"""

import os
import sys
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import uuid4
import time
from dotenv import load_dotenv

# Reconfigure stdout to avoid UnicodeEncodeError on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except:
    pass

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from backend.scripts.tkpi_ingestion_utils import filter_new_foods

# ==========================================
# CONFIGURATION
# ==========================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY", "")  # Service Role Key untuk bypass RLS

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERROR: SUPABASE_URL dan SUPABASE_KEY tidak ditemukan di environment variables!")
    print("   Set: export SUPABASE_URL='...' && export SUPABASE_KEY='...'")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

TKPI_URL = "https://www.andrafarm.com/_andra.php?_i=daftar-tkpi"
TKPI_MAX_PAGES = 30  # Estimated pages (akan berhenti otomatis jika tidak ada data)
BATCH_SIZE = 50  # Reduced dari 100 untuk avoid timeout
CHUNK_DELAY = 2  # Detik antara batch (jangan terlalu cepat ke server)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
)

# ==========================================
# UTILITY FUNCTIONS
# ==========================================

def clean_number(val_element) -> Optional[float]:
    """
    Extract and clean number from HTML td/th element.
    
    Handles:
      - Missing data ('-')
      - Indonesian number format (. as thousands, , as decimal)
      - Empty strings
    
    Returns: float or None
    """
    try:
        val = val_element.text.strip()
    except:
        return None
    
    if val == '-' or val == '' or val == 'N/A':
        return None
    
    try:
        # Indonesian format: 1.000,5 → 1000.5
        val = val.replace('.', '').replace(',', '.')
        return float(val)
    except (ValueError, AttributeError):
        return None


def extract_food_data(cols: List) -> Optional[Dict[str, Any]]:
    """
    Extract single food row dari HTML table row.
    
    Expected column order (28 columns):
      [0] Urut, [1] ID Bahan, [2] Nama, [3] Air, [4] Energi, [5] Protein, 
      [6] Lemak, [7] KH, [8] Serat, [9] Abu, [10] Kalsium, [11] Fosfor, 
      [12] Besi, [13] Natrium, [14] Kalium, [15] Tembaga, [16] Seng, 
      [17] Retinol, [18] Beta Karoten, [19] Karoten Total, [20] Thiamin, 
      [21] Riboflavin, [22] Niasin, [23] Vitamin C, [24] BDD%, [25] Kondisi, 
      [26] Kategori, [27] Tahun
    """
    
    if len(cols) < 28:
        return None
    
    # Validasi: kolom pertama harus angka (urut/nomor)
    try:
        urut = cols[0].text.strip()
        if not urut.isdigit():
            return None
    except:
        return None
    
    food_name = cols[2].text.strip()
    if not food_name:
        return None
    
    # Main nutrients (makronutrien) - kolom utama
    item = {
        "name": food_name,
        "calories": clean_number(cols[4]),  # Energi (kcal)
        "proteins": clean_number(cols[5]),  # Protein (g)
        "fat": clean_number(cols[6]),       # Lemak (g)
        "carbohydrate": clean_number(cols[7]),  # KH (g)
        "fiber": clean_number(cols[8]),     # Serat (g)
        "sodium": clean_number(cols[13]),   # Natrium (mg)
        "potassium": clean_number(cols[14]),  # Kalium (mg)
        "kategori": cols[26].text.strip().lower() or "lainnya",
        "data_source": "TKPI_" + cols[27].text.strip(),
        
        # Micronutrients & metadata - custom_nutrients (JSONB)
        "custom_nutrients": {
            "id_bahan": cols[1].text.strip(),
            "kondisi": cols[25].text.strip(),
            "bdd_persen": clean_number(cols[24]),
            "air_g": clean_number(cols[3]),
            "abu_g": clean_number(cols[9]),
            "kalsium_mg": clean_number(cols[10]),
            "fosfor_mg": clean_number(cols[11]),
            "besi_mg": clean_number(cols[12]),
            "tembaga_mg": clean_number(cols[15]),
            "seng_mg": clean_number(cols[16]),
            "retinol_mcg": clean_number(cols[17]),
            "b_karoten_mcg": clean_number(cols[18]),
            "karoten_total_mcg": clean_number(cols[19]),
            "thiamin_mg": clean_number(cols[20]),
            "riboflavin_mg": clean_number(cols[21]),
            "niasin_mg": clean_number(cols[22]),
            "vitamin_c_mg": clean_number(cols[23]),
            "sumber": "TKPI",
            "tahun": cols[27].text.strip(),
            "kategori_tkpi": cols[26].text.strip(),
        }
    }
    
    return item


# ==========================================
# MAIN SCRAPING FUNCTION
# ==========================================

def insert_batch_with_fallback(batch_items: List[Dict[str, Any]]) -> int:
    """Insert a batch using insert semantics and update existing rows by name when they need a richer TKPI payload."""
    if not batch_items:
        return 0

    inserted = 0
    for item in batch_items:
        name = (item.get('name') or '').strip()
        if not name:
            continue

        existing_name = None
        try:
            existing_resp = supabase.table('nutrition_ref').select('id,name').eq('name', name).limit(1).execute()
            if existing_resp.data:
                existing_name = existing_resp.data[0].get('name')
        except Exception:
            existing_name = None

        try:
            if existing_name:
                update_payload = {k: v for k, v in item.items() if k != 'name'}
                if update_payload.get('custom_nutrients') in ({}, None):
                    continue
                supabase.table('nutrition_ref').update(update_payload).eq('name', name).execute()
                inserted += 1
            else:
                resp = supabase.table('nutrition_ref').insert(item).execute()
                if resp.data:
                    inserted += 1
        except Exception as inner_exc:
            inner_error = str(inner_exc).lower()
            if 'duplicate' in inner_error or 'unique' in inner_error:
                continue
            raise

    return inserted


def scrape_and_push_tkpi():
    """
    Main function:
      1. Fetch HTML dari TKPI website
      2. Parse tabel dengan BeautifulSoup
      3. Extract nutrition data per bahan
      4. Push batch ke Supabase nutrition_ref table
      5. Track progress dan error handling
    """
    
    print("=" * 70)
    print("[*] TKPI DATA SCRAPING & POPULATION")
    print("=" * 70)
    print(f"[*] Target URL: {TKPI_URL}")
    print(f"[*] Batch Size: {BATCH_SIZE} items per insert")
    print(f"[*] Supabase URL: {SUPABASE_URL[:50]}...")
    print()
    
    # ────────────────────────────────────────
    # STEP 1-3: Fetch + Parse + Extract dari semua halaman
    # ────────────────────────────────────────
    print("\n[1] Fetching & parsing dari semua halaman TKPI...")
    data_batch = []
    skipped = 0
    total_rows_fetched = 0
    
    for page_num in range(1, TKPI_MAX_PAGES + 1):
        if page_num == 1:
            page_url = TKPI_URL
        else:
            no1 = (page_num - 2) * 40 + 1
            no2 = (page_num - 1) * 40
            page_url = f"{TKPI_URL}&perhal=40&no1={no1}&no2={no2}&kk={page_num}"
        
        success = False
        response = None
        for attempt in range(1, 4):
            try:
                response = requests.get(page_url, headers={"User-Agent": USER_AGENT}, timeout=30)
                response.raise_for_status()
                success = True
                break
            except requests.RequestException as e:
                print(f"   ⚠️  Page {page_num} attempt {attempt}/3 failed: {e}")
                if attempt < 3:
                    time.sleep(attempt * 2)

        if not success:
            print(f"   ❌ Page {page_num} gagal total setelah 3 attempt. Lanjut ke halaman berikutnya...")
            continue
            
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            rows = soup.find_all('tr')
            
            if len(rows) <= 1:  # Hanya header, berarti halaman kosong
                print(f"   ℹ️  Page {page_num}: kosong (stop)")
                break
            
            total_rows_fetched += len(rows)
            print(f"   ✅ Page {page_num}: {len(rows)} rows")
            
            # Extract dari halaman ini
            for idx, row in enumerate(rows):
                cols = row.find_all(['td', 'th'])
                food_item = extract_food_data(cols)
                
                if food_item:
                    data_batch.append(food_item)
                else:
                    skipped += 1
            
        except Exception as e:
            print(f"   ❌ Error parsing Page {page_num}: {e}")
            continue
    
    print(f"\n   📊 Total dari {page_num} halaman: {len(data_batch)} items valid, {skipped} skipped")
    
    total_data = len(data_batch)
    
    if total_data == 0:
        print("   ❌ Tidak ada data yang berhasil di-extract. Cek HTML structure.")
        sys.exit(1)
    
    # ────────────────────────────────────────
    # STEP 4: Push to Supabase
    # ────────────────────────────────────────
    print(f"\n[4] Pushing {total_data} items to Supabase (batch size: {BATCH_SIZE})...")
    print()
    
    success_count = 0
    error_count = 0
    skipped_count = 0

    existing_names = set()
    try:
        existing_resp = supabase.table('nutrition_ref').select('name').execute()
        existing_names = {item.get('name', '').strip().lower() for item in existing_resp.data or [] if item.get('name')}
    except Exception as exc:
        print(f"   ⚠️  Gagal mengambil existing names: {exc}")
    
    for batch_num, i in enumerate(range(0, total_data, BATCH_SIZE)):
        chunk = data_batch[i:i + BATCH_SIZE]
        batch_num += 1
        
        print(f"   DEBUG: Batch {batch_num} ready to insert. Chunk size: {len(chunk)}, First item name: {chunk[0].get('name', 'N/A')[:30] if chunk else 'empty'}")
        
        new_chunk, skipped = filter_new_foods(chunk, existing_names)
        skipped_count += skipped

        if not new_chunk:
            print(f"   ⏭️  Batch {batch_num}: semua item sudah ada, dilewati")
            continue
        
        try:
            print(f"   📤 Batch {batch_num}: Inserting {len(new_chunk)} new items...", end=" ", flush=True)
            
            inserted_count = insert_batch_with_fallback(new_chunk)
            
            if inserted_count:
                print(f"✅ ({inserted_count} rows)")
                success_count += inserted_count
                existing_names.update({item.get('name', '').strip().lower() for item in new_chunk if item.get('name')})
            else:
                print(f"⚠️  (no rows inserted)")
            
            # Jangan hammer server - tambah delay antar batch
            if batch_num < (total_data + BATCH_SIZE - 1) // BATCH_SIZE:
                time.sleep(CHUNK_DELAY)
                
        except Exception as e:
            error_msg = str(e)
            print(f"❌ ERROR: {error_msg[:50]}...")
            error_count += 1
            
            # Coba detail dari error
            if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
                time.sleep(5)
            else:
                print(f"      → Full error: {error_msg}")
    
    # ────────────────────────────────────────
    # STEP 5: Summary
    # ────────────────────────────────────────
    print()
    print("=" * 70)
    print("✨ SCRAPING COMPLETE")
    print("=" * 70)
    print(f"📊 Summary:")
    print(f"   Total extracted: {total_data:,} items")
    print(f"   Successfully inserted: {success_count:,} items")
    print(f"   Skipped existing items: {skipped_count:,}")
    print(f"   Failed batches: {error_count}")
    print(f"   Success rate: {(success_count/total_data*100):.1f}%")
    print()
    
    if success_count > 0:
        print("🎉 BERHASIL! Data TKPI sudah masuk ke nutrition_ref table.")
        print()
        print("📝 Next steps:")
        print("   1. Run: python backend/scan_duplicates.py")
        print("      → Verify data yang masuk + check mapping ke products")
        print()
        print("   2. Setup auto-linking di backend:")
        print("      → Products akan auto-match ke nutrition_ref by fuzzy search")
        print()
        print("   3. Test nutrition calculation:")
        print("      → POST /nutrition/menu/{menu_id} → lihat hasil kalkulasi")
        print()
    else:
        print("⚠️  WARNING: Tidak ada data yang berhasil diinsert.")
        print("   Cek:")
        print("   - Supabase connection (SUPABASE_URL, SUPABASE_KEY)")
        print("   - nutrition_ref table sudah ada di database")
        print("   - RLS policy (gunakan Service Role Key)")


if __name__ == "__main__":
    scrape_and_push_tkpi()
