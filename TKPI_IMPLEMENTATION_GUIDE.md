# 🚀 TKPI Implementation Guide - Step by Step

**Status:** Implementation Package Ready  
**Date:** 2026-06-19  
**Impact:** 1000+ global nutrition database entries

---

## 📋 What Was Done

### ✅ Created Files

1. **`backend/scripts/migration_nutrition_ref_v2.sql`**
   - Migration script untuk upgrade nutrition_ref table
   - Adds: custom_nutrients (JSONB), data_source, updated_at columns
   - Creates: UNIQUE constraint pada name, trigram index untuk fuzzy search, view untuk akses mudah
   - Safe to run: Backward compatible, all fields NULLABLE

2. **`backend/scripts/scrape_tkpi.py`**
   - Python scraper untuk extract 1000+ bahan TKPI dari web
   - Handles: Indonesian number format, data cleaning, batch insertion
   - Includes: Full error handling, progress tracking, batch delays (rate limiting)

3. **`backend/routers/ingredients.py`** (Updated)
   - Enhanced POST endpoint: Support custom_nutrients + data_source
   - Enhanced PUT endpoint: Support full TKPI schema
   - Better error handling: UNIQUE constraint violations

---

## 🔧 Implementation Steps (4-5 Hours)

### Step 1: Run Migration Script (5-10 min) ⭐

**Option A: Via Supabase UI (Recommended)**
```
1. Go to: https://app.supabase.com → Your Project → SQL Editor
2. Create new query
3. Copy-paste dari: backend/scripts/migration_nutrition_ref_v2.sql
4. Click "Run"
5. Verify output: Should see "Table nutrition_ref" with row counts
```

**Option B: Via psql (if you have direct DB access)**
```bash
psql "postgresql://..." < backend/scripts/migration_nutrition_ref_v2.sql
```

**What it does:**
- ✅ Adds custom_nutrients (JSONB) column
- ✅ Adds data_source column (tracking TKPI vs MANUAL vs AI)
- ✅ Adds updated_at timestamp
- ✅ Creates UNIQUE constraint pada name (prevent duplicates)
- ✅ Creates trigram index untuk fuzzy search
- ✅ Creates view nutrition_ref_with_summary (easy access to micronutrients)

**Expected output:**
```
NOTICE: CREATE EXTENSION pg_trgm
Table nutrition_ref updated successfully
Total entries: ~50 (dari manual entry sebelumnya)
```

---

### Step 2: Setup Environment Variables (5 min)

Di PC Anda, set environment variables untuk Supabase connection:

**Windows PowerShell:**
```powershell
$env:SUPABASE_URL = "https://xxxxx.supabase.co"
$env:SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Linux/Mac (bash):**
```bash
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Mana yang pakai?**
- `SUPABASE_URL`: Dari Project Settings → API
- `SUPABASE_KEY`: **GUNAKAN SERVICE_ROLE_KEY** (bukan anon key!)
  - Ke URL: https://app.supabase.com → Project → Settings → API
  - Copy `service_role` key (hidden, klik show)

⚠️ **SECURITY:** Service Role Key = super powerful. Simpan aman, jangan commit ke git.

---

### Step 3: Install Dependencies (2 min)

```bash
# Di terminal, go ke project root
cd "c:\Users\Lenovo\OneDrive\folder fix"

# Install Python dependencies
pip install requests beautifulsoup4 supabase python-dotenv

# Verify
python -c "import requests; import bs4; import supabase; print('✅ All OK')"
```

---

### Step 4: Run Scraping Script (5-10 min)

```bash
# Set env vars dulu (see Step 2)

# Navigate ke backend
cd backend/scripts

# Run scraper
python scrape_tkpi.py
```

**Expected output:**
```
======================================================================
🔥 TKPI DATA SCRAPING & POPULATION
======================================================================
📍 Target URL: https://www.andrafarm.com/_andra.php?_i=daftar-tkpi
📚 Batch Size: 100 items per insert
🗄️  Supabase URL: https://xxxxx.supabase.co...

1️⃣  Fetching HTML from TKPI website...
   ✅ HTTP 200 - Downloaded 1250000 bytes

2️⃣  Parsing HTML dengan BeautifulSoup...
   ✅ Ditemukan 1200 baris (termasuk header)

3️⃣  Extracting & cleaning nutrition data...
   ✅ Extracted: 1087 items
   ⚠️  Skipped: 112 rows (header, invalid format, etc)

4️⃣  Pushing 1087 items to Supabase (batch size: 100)...

   📤 Batch 1: Inserting 100 items... ✅ (100 rows)
   📤 Batch 2: Inserting 100 items... ✅ (100 rows)
   📤 Batch 3: Inserting 100 items... ✅ (100 rows)
   ...
   📤 Batch 11: Inserting 87 items... ✅ (87 rows)

======================================================================
✨ SCRAPING COMPLETE
======================================================================
📊 Summary:
   Total extracted: 1,087 items
   Successfully inserted: 1,087 items
   Failed batches: 0
   Success rate: 100.0%

🎉 BERHASIL! Data TKPI sudah masuk ke nutrition_ref table.

📝 Next steps:
   1. Run: python backend/scan_duplicates.py
      → Verify data yang masuk + check mapping ke products
   ...
```

**Troubleshooting:**

| Error | Cause | Fix |
|-------|-------|-----|
| `SUPABASE_URL dan SUPABASE_KEY tidak ditemukan` | Env vars not set | Set via PowerShell/bash (Step 2) |
| `HTTP 404 / 403` | Website down atau blocked | Cek URL, try manually di browser |
| `unique constraint violation` | Data sudah ada | Skip batch, OK (akan terus ke batch berikutnya) |
| `Connection timeout` | Server slow | Script retry otomatis, OK |

---

### Step 5: Verify Data (5 min)

**Via Backend Script:**
```bash
cd backend
python scan_duplicates.py
```

**Expected output:**
```
PART 2: NUTRITION REFERENCE MAPPING STATUS
MAPPED:    850 products (auto-linked ke nutrition_ref by fuzzy match)
UNMAPPED:  237 products (belum ada matching nutrition ref)
MISMATCHED: 0 products

PART 3: ALL NUTRITION_REF ENTRIES
Total nutrition_ref entries: 1,087 (dari TKPI)
  - TKPI_2024: 1,087 entries
  - MANUAL: 12 entries
  - GEMINI_AI: 5 entries
  ...Total: 1,104 entries
```

**Via Supabase UI:**
```
Go to: https://app.supabase.com → Your Project → Tables → nutrition_ref
Click "Edit table" → Scroll ke kanan → lihat custom_nutrients, data_source columns
```

**Via Backend Endpoint (setelah restart):**
```bash
curl -X GET "http://localhost:8000/api/ingredients/master" \
  -H "Authorization: Bearer <your_token>"
```

---

### Step 6: Restart Backend & Test (5 min)

```bash
# Terminal 1: Backend
cd backend
python -m uvicorn main:app --reload

# Terminal 2: Test
curl "http://localhost:8000/api/ingredients/master?limit=5" \
  -H "Authorization: Bearer <your_token>"
```

**Expected response:**
```json
[
  {
    "id": "uuid-1",
    "name": "Beras Giling",
    "calories": 130,
    "proteins": 2.6,
    "fat": 0.3,
    "carbohydrate": 28.6,
    "fiber": 0.4,
    "sodium": 1,
    "potassium": 70,
    "kategori": "sereal",
    "data_source": "TKPI_2024",
    "custom_nutrients": {
      "id_bahan": "1001",
      "air_g": 12,
      "kalsium_mg": 6,
      "besi_mg": 0.8,
      "vitamin_c_mg": 0,
      ...
    },
    "updated_at": "2026-06-19T12:34:56Z"
  },
  ...
]
```

---

### Step 7: Test Recipe Nutrition Calculation (10 min)

**Create test menu dengan recipes:**

```bash
# POST /menus
{
  "name": "Nasi + Ayam Goreng",
  "school_id": "school-123",
  "date": "2026-06-20"
}
# → returns menu_id

# POST /recipes
{
  "menu_id": "menu-123",
  "ingredient_id": "beras-giling-id",
  "qty_needed": 50,
  "unit": "gram"
}

# GET /nutrition/menu/{menu_id}
# → Should show: Calories: 65 kcal, Protein: 1.3g, etc
```

---

## 📊 What Changed

### Before (Old Schema)
```sql
CREATE TABLE nutrition_ref (
  id UUID PRIMARY KEY,
  name TEXT,
  calories FLOAT,
  proteins FLOAT,
  fat FLOAT,
  carbohydrate FLOAT,
  fiber FLOAT,
  kategori TEXT
);
```

### After (New Schema)
```sql
CREATE TABLE nutrition_ref (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE,  -- ← NEW
  calories FLOAT,
  proteins FLOAT,
  fat FLOAT,
  carbohydrate FLOAT,
  fiber FLOAT,
  sodium FLOAT,      -- ← NEW
  potassium FLOAT,   -- ← NEW
  kategori TEXT,
  data_source TEXT DEFAULT 'MANUAL',          -- ← NEW
  custom_nutrients JSONB,                     -- ← NEW
  updated_at TIMESTAMP DEFAULT NOW()          -- ← NEW
);
```

**Benefits:**
- ✅ 1000+ complete TKPI data (not just macros)
- ✅ Micronutrients available for queries
- ✅ Prevents duplicate data entry
- ✅ Tracks data source (TKPI vs manual vs AI)
- ✅ Indexed for fast fuzzy search

---

## 🔄 Data Auto-Linking Flow

Setelah scraping selesai:

```
1. User create produk baru "Nasi Kuning"
   ↓
2. Backend trigger nutrition_service.map_and_link_product()
   ↓
3. Fuzzy search di nutrition_ref mencari match
   ↓
4. Jika ketemu (e.g., "Beras Giling") → auto-link (nutrition_ref_id)
   ↓
5. Jika tidak ketemu → call Gemini AI
   ↓
6. AI returns suggestions → simpan ke nutrition_aliases (learning DB)
   ↓
7. Produk sekarang punya nutrition data → bisa calculate kalori
```

---

## 📝 Common Tasks

### Query Micronutrients
```sql
-- Get semua entries dengan vitamin C > 10mg
SELECT 
  name, 
  calories,
  (custom_nutrients->>'vitamin_c_mg')::float as vit_c_mg
FROM nutrition_ref
WHERE (custom_nutrients->>'vitamin_c_mg')::float > 10
ORDER BY (custom_nutrients->>'vitamin_c_mg')::float DESC
LIMIT 20;
```

### Export untuk Spreadsheet
```bash
# Via Supabase export:
supabase db dump
# atau
# Via API:
curl "http://localhost:8000/api/ingredients/master?export=csv" > nutrition_ref.csv
```

### Update Single Entry (jika ada error)
```bash
curl -X PUT "http://localhost:8000/api/ingredients/master/{id}" \
  -H "Content-Type: application/json" \
  -d '{
    "calories": 132,
    "custom_nutrients": {
      "vitamin_c_mg": 15
    }
  }'
```

---

## 🚨 Important Notes

### 1. Service Role Key Security
- Jangan di-commit ke git
- Jangan expose di public (API responses, logs, etc)
- Rotation recommended setiap 3 bulan
- Set environment variable saja (tidak hardcode)

### 2. Rate Limiting
- Scraper punya 2-second delay antar batch (prevent server hammer)
- Jika error 429 (too many requests), tunggu 5 menit

### 3. Data Integrity
- UNIQUE constraint pada `name` (case-insensitive) prevent duplikasi
- Jika scraping gagal di batch X, batch tersebut tidak ter-insert
- Resume safe: jalankan ulang, duplikasi akan di-reject otomatis

### 4. Backup Sebelum Migrate
```sql
-- Create backup table sebelum migration
CREATE TABLE nutrition_ref_backup AS SELECT * FROM nutrition_ref;
```

---

## ✅ Success Checklist

- [ ] Migration SQL sudah run di Supabase
- [ ] Environment variables set (SUPABASE_URL, SUPABASE_KEY)
- [ ] Dependencies installed (requests, beautifulsoup4, supabase)
- [ ] Scraping script berhasil run (1000+ entries inserted)
- [ ] Verify via scan_duplicates.py
- [ ] Test GET /ingredients/master endpoint
- [ ] Test recipe nutrition calculation
- [ ] Data visible di Supabase UI

---

## 📞 Next Steps

1. **Today:** Run migration + scraping (2-3 hours)
2. **Tomorrow:** Update frontend untuk display micronutrients
3. **This week:** Train team on new nutrition database
4. **Next week:** Deploy ke production

---

**Questions?** Refer ke:
- Migration errors → `migration_nutrition_ref_v2.sql` comments
- Scraping issues → `scrape_tkpi.py` docstrings
- API changes → `ingredients.py` updated endpoints

🚀 Ready to go!
