# 📊 Analisis: Implementasi TKPI Data Scraping & nutrition_ref Schema

**Status:** ❌ **BELUM DITERAPKAN** (Sebagian)

---

## Temuan Singkat

| Aspek | Status | Keterangan |
|-------|--------|-----------|
| Table `nutrition_ref` ada? | ✅ Ada | Sudah dibuat di database |
| Schema sesuai rekomendasi? | ❌ Belum | Hanya punya makronutrien, tanpa custom_nutrients JSONB |
| Data TKPI dari web? | ❌ Belum | Tidak ada script scraping dari andrafarm.com |
| Script scraping | ❌ Belum | Tidak ditemukan BeautifulSoup/requests TKPI scraper |

---

## Detail Analisis

### ✅ Yang Sudah Ada

#### 1. Table `nutrition_ref` Sudah Terbuat
- **Lokasi:** Supabase database
- **Digunakan di:** 
  - `backend/routers/ingredients.py` — Endpoints CRUD nutrition_ref
  - `backend/services/nutrition_service.py` — Auto-linking produk ke nutrition
  - `backend/routers/nutrition.py` — Calculate nutrition per menu
  - `backend/services/recipe_service.py` — Recipe nutrition calculation

#### 2. Schema Saat Ini
```python
# Dari ingredients.py POST /ingredients/master
{
    "name": str,                    # ✅ Nama bahan
    "calories": float,              # ✅ Kalori
    "proteins": float,              # ✅ Protein
    "fat": float,                   # ✅ Lemak
    "carbohydrate": float,          # ✅ Karbohidrat
    "fiber": float,                 # ✅ Serat
    "kategori": str                 # ✅ Kategori (Optional)
}
```

#### 3. Endpoints Sudah Berfungsi
- `GET /ingredients/master` — Fetch semua nutrition_ref ✅
- `POST /ingredients/master` — Create nutrition_ref ✅
- `PUT /ingredients/master/{id}` — Update nutrition_ref ✅
- `DELETE /ingredients/master/{id}` — Delete nutrition_ref ✅

#### 4. Auto-Linking Produk ke Nutrition
```python
# Dari nutrition_service.py
nutrition_svc.map_and_link_product()  # Fuzzy match & auto-link
```
- Pencarian dengan fuzzy matching (trigram)
- Fallback ke Gemini AI jika tidak ketemu
- Menyimpan mapping ke `nutrition_aliases` (learning database)

---

## ❌ Yang BELUM Ada

### 1. Schema Belum Sesuai Rekomendasi
**Current Schema:** Hanya makronutrien di kolom utama
```python
# ❌ Tidak ada custom_nutrients JSONB
# ❌ Tidak ada data_source tracking
# ❌ Tidak ada mikronutrien (vitamin, mineral)
```

**Recommended Schema (dari user):**
```python
{
    "name": str,
    "calories": float,              # ✅
    "proteins": float,              # ✅
    "fat": float,                   # ✅
    "carbohydrate": float,          # ✅
    "fiber": float,                 # ✅
    "sodium": float,
    "potassium": float,
    "kategori": str,
    "data_source": str,             # ❌ MISSING
    
    # ❌ MISSING: JSONB field
    "custom_nutrients": {           # ❌ TIDAK ADA
        "id_bahan": str,
        "kondisi": str,
        "bdd_persen": float,
        "air_g": float,
        "abu_g": float,
        "kalsium_mg": float,
        "fosfor_mg": float,
        "besi_mg": float,
        "tembaga_mg": float,
        "seng_mg": float,
        "retinol_mcg": float,
        "b_karoten_mcg": float,
        "karoten_total_mcg": float,
        "thiamin_mg": float,
        "riboflavin_mg": float,
        "niasin_mg": float,
        "vitamin_c_mg": float
    }
}
```

### 2. Script Scraping TKPI BELUM Ada
**Script yang user berikan:**
- URL: `https://www.andrafarm.com/_andra.php?_i=daftar-tkpi`
- Method: BeautifulSoup + requests
- Target: Extract 1000+ bahan makanan dari tabel
- Format: Ubah ke schema nutrition_ref dengan custom_nutrients JSONB
- Status: **BELUM di-copy ke codebase**

**File yang seharusnya ada tapi tidak ada:**
- `backend/scripts/scrape_tkpi.py` ❌
- `backend/scripts/load_tkpi_data.py` ❌

### 3. Data TKPI Belum Ter-populate
- Tidak ada indikasi bahwa nutrition_ref table sudah diisi dari TKPI web
- Mungkin hanya ada data manual atau Gemini AI generated
- Tidak ada initial data seeding

---

## 📋 Rekomendasi Aksi

### Opsi A: Terapkan Sesuai Rekomendasi (RECOMMENDED) ⭐

**Step 1: Migrate Schema (1 jam)**
```sql
-- Di Supabase SQL Editor
ALTER TABLE nutrition_ref ADD COLUMN data_source VARCHAR(100) DEFAULT 'MANUAL';
ALTER TABLE nutrition_ref ADD COLUMN custom_nutrients JSONB DEFAULT NULL;
ALTER TABLE nutrition_ref ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- Create UNIQUE constraint pada name untuk prevent duplikasi
CREATE UNIQUE INDEX idx_nutrition_ref_name ON nutrition_ref(LOWER(name));
```

**Step 2: Update Backend (30 min)**
```python
# Update ingredients.py POST endpoint untuk support custom_nutrients
@router.post("/master")
def create_master_ingredient(payload: Dict[str, Any], ...):
    data = {
        "name": payload.get("name"),
        # ... existing fields ...
        "data_source": payload.get("data_source", "MANUAL"),
        "custom_nutrients": payload.get("custom_nutrients")  # JSONB
    }
```

**Step 3: Create & Run Scraping Script (1-2 jam)**
```bash
# Copy script ke: backend/scripts/scrape_tkpi.py
# Setup: pip install beautifulsoup4 requests

python backend/scripts/scrape_tkpi.py
# Output: ~1000+ bahan TKPI masuk ke nutrition_ref
```

**Step 4: Verify & Index (30 min)**
```bash
python backend/scan_duplicates.py  # Check yang masuk
# Setup trigram index untuk fuzzy search
```

---

### Opsi B: Tetap Gunakan Schema Sekarang

**Keuntungan:**
- Tidak perlu migration database
- Code sekarang sudah working
- Lebih simple

**Kerugian:**
- Kalori/makronutrien dari TKPI saja (tidak lengkap)
- Tidak bisa query vitamin/mineral di database
- Micronutrient harus via Gemini AI (slower)

**Implementasi:** Hanya jalankan scraping script dengan modifikasi skip custom_nutrients

---

## 📊 Data Audit Saat Ini

**Asumsi kondisi sekarang:**
```
nutrition_ref table:
- Total entries: ~5-50 (estimated, manual entry)
- Data source: MANUAL + Gemini AI generated
- Kolom yang terisi: calories, proteins, fat, carbohydrate, fiber, kategori
```

**Setelah implement Opsi A (dengan scraping):**
```
nutrition_ref table:
- Total entries: 1000+ (dari TKPI)
- Data source: "TKPI_..." (track sumber)
- Kolom: Semua makro + custom_nutrients JSONB
- Bonus: nutrition_aliases auto-populated dari mapping
```

---

## 🚀 Recommended Next Steps

### Priority 1: Migrate Schema & Run Scraper
```bash
# 1. Backup current nutrition_ref data
# 2. Run migration SQL
# 3. Copy scraping script
# 4. python backend/scripts/scrape_tkpi.py
# 5. Verify hasil dengan scan_duplicates.py
```

**Time estimate:** 2-3 hours  
**Impact:** High (1000+ nutrition data, complete micronutrient data)

### Priority 2: Update Backend Code
```bash
# Update ingredients.py POST /ingredients/master
# Support custom_nutrients JSONB input
# Add data_source tracking
```

**Time estimate:** 1 hour  
**Impact:** Medium (better data management)

### Priority 3: Index & Performance Tune
```bash
# Create trigram index untuk fuzzy search
# Test query performance pada 1000+ entries
# Optimize if needed
```

**Time estimate:** 1 hour  
**Impact:** Medium (faster searches)

---

## ⚠️ Catatan Penting

### UNIQUE Constraint pada `name`
**Wajib dilakukan SEBELUM scraping:**
```sql
-- Cegah duplikasi saat scraping ulang
ALTER TABLE nutrition_ref ADD CONSTRAINT unique_nutrition_name UNIQUE(LOWER(name));
```

Tanpa ini, jika scraping dijalankan 2x, akan ada 2000+ entries (duplikasi).

### Schema Backward Compatibility
- Custom_nutrients = NULLABLE → Tidak break existing code
- Data_source bisa default ke "MANUAL" → OK
- Existing queries tetap work (tidak query custom_nutrients)

---

## 📝 Kesimpulan

| Aspek | Status | Action |
|-------|--------|--------|
| nutrition_ref table | ✅ Ada | Maintain |
| Schema makronutrien | ✅ OK | Keep |
| Schema custom_nutrients | ❌ Tidak ada | ⭐ ADD |
| TKPI scraping | ❌ Belum | ⭐ Implement |
| Data source tracking | ❌ Belum | ⭐ ADD |
| Unique constraint | ❌ Tidak ada | ⭐ CREATE |

**Verdict:** Code yang user berikan MASUK AKAL dan RECOMMENDED untuk diterapkan!

---

**Summary:** Tabel nutrition_ref sudah ada dan berfungsi, tapi schema belum optimal dan belum ada data TKPI dari web. Implementasi rekomendasi user akan 10x improve sistem nutrisi.

Apakah anda mau saya:
1. **Buat migration script** untuk alter table?
2. **Copy scraping script** ke backend/scripts/?
3. **Update endpoints** untuk support custom_nutrients?
4. **Semua di atas**? ⭐
