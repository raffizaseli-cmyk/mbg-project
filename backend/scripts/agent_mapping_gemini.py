#!/usr/bin/env python3
"""
AI Agent Mapping Engine for MBG Catering
=========================================

Purpose:
  1. Read nutrition_ref (TKPI database) in batches of 100.
  2. Query active catering products that have TKPI references.
  3. Send data to Gemini API to filter common ingredients and generate mapping keywords + unit conversions.
  4. Write results directly into standard tables:
     - `ingredient_unit_weights` (for Referensi Satuan tab)
     - `product_aliases` (for Mapping Bahan -> Daftar Mapping tab)
     - `nutrition_aliases` (for Recipe slang-to-TKPI resolution)

Usage:
  python backend/scripts/agent_mapping_gemini.py
"""

import os
import sys
import json
import time
import re
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment configuration from backend/.env
ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # Bypass RLS to perform writes/inserts
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-3.1-flash-lite")

# ==========================================
# SYSTEM PROMPT (INSTRUKSI AI)
# ==========================================
SYSTEM_INSTRUCTION = """
Kamu adalah AI Asisten Gizi dan Database Master untuk program katering massal Makan Bergizi Gratis (MBG) di Indonesia.
Tugasmu adalah menganalisis batch data bahan makanan dari TKPI (Tabel Komposisi Pangan Indonesia) dan merumuskan konversi satuan baku serta variasi kata kunci belanja pasarnya.

Tugas detailmu:
1. FILTERING:
   - Tentukan apakah bahan makanan TKPI ini LAZIM digunakan dalam katering massal di Indonesia (misal: beras, ayam, telur, wortel, bawang, kangkung, dll.).
   - ABAIKAN bahan makanan yang tidak lazim (misal: daging ular, kelelawar, jeroan langka) atau makanan matang/olahan spesifik (misal: "Nasi goreng", "Martabak").
   - PENTING: Database TKPI berisi banyak jajanan daerah/matang (seperti 'Amparan Tatak', 'Bagea'). Kamu WAJIB mengabaikan bahan yang tidak mungkin dibeli mentah di pasar tradisional untuk katering massal. Fokuslah hanya pada bahan baku primer.
   - Jika nama bahan mengandung koma (misal: 'Bayam, segar'), anggap nama utamanya adalah 'Bayam' dan kondisinya adalah 'Segar'.

2. KONVERSI SATUAN (REFERENSI SATUAN):
   - Tentukan satuan belanja yang masuk akal di pasar tradisional/supermarket Indonesia untuk bahan tersebut (misal: kg, gram, ekor, ikat, papan, bungkus, karung, butir, pcs).
   - Berikan estimasi berat bersih murni bahan tersebut dalam SATUAN GRAM (atau MILILITER jika cairan).
   - Contoh berat satuan di Indonesia:
     - 1 kg = 1000 gram
     - 1 ekor ayam = 800 gram (berat bersih daging setelah dipotong)
     - 1 papan telur = 1860 gram (~30 butir x 62g)
     - 1 butir telur = 62 gram
     - 1 ikat kangkung/bayam = 250 gram
     - 1 karung beras = 25000 gram (25 kg)
     - 1 pcs/buah bawang bombay = 150 gram

3. KEYWORD NOTA / SLANG (NUTRITION & PRODUCT ALIASES):
   - Tentukan variasi nama slang, singkatan pasar, atau penulisan nota kasir yang biasa dipakai orang Indonesia untuk merujuk ke bahan TKPI tersebut.
   - Contoh "Ayam, daging dan kulit": ["ayam potong", "daging ayam", "ayam utuh", "ayam negeri"]
   - Contoh "Bawang Merah": ["bamer", "b.merah", "bawang merah lokal"]

Kembalikan output dalam format JSON murni berupa array of objects seperti skema berikut (tanpa markdown fences):
[
  {
    "id_nutrition_ref": "UUID_DARI_INPUT",
    "nama_tkpi": "Nama asli bahan dari input",
    "nama_bersih": "Nama bahan bersih tanpa kondisi",
    "kondisi": "Kondisi bahan jika ada, misal Segar, Kering, Mentah",
    "kategori_induk": "Kategori umum, misal: Ayam, Sapi, Sayuran, Bumbu",
    "keyword_nota": ["keyword1", "keyword2", ...],
    "konversi_satuan": [
      {"satuan": "nama_satuan", "berat_gram": angka_float_atau_int},
      ...
    ]
  }
]
"""

# ==========================================
# CLIENT INITIALIZATION
# ==========================================
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required in backend/.env!")
    sys.exit(1)

if not GEMINI_API_KEY:
    print("❌ ERROR: GEMINI_API_KEY is not set in backend/.env!")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_products_with_nutrition() -> tuple[dict, dict]:
    """Fetch active products that have a nutrition_ref_id, grouping by nutrition_ref_id."""
    try:
        print("📥 Loading active catering products linked to TKPI from database...")
        resp = supabase.table("products") \
            .select("id, name, tenant_id, nutrition_ref_id") \
            .not_.is_("nutrition_ref_id", "null") \
            .eq("is_active", True) \
            .execute()
        
        products = resp.data or []
        ref_to_products = {}
        ref_counts = {}
        for p in products:
            ref_id = p.get("nutrition_ref_id")
            if ref_id:
                if ref_id not in ref_to_products:
                    ref_to_products[ref_id] = []
                ref_to_products[ref_id].append(p)
                ref_counts[ref_id] = ref_counts.get(ref_id, 0) + 1
                
        print(f"   ✅ Found {len(products)} products mapped to TKPI database.")
        return ref_to_products, ref_counts
    except Exception as e:
        print(f"   ⚠️ Could not fetch product context: {e}")
        return {}, {}


def call_gemini_api(prompt: str) -> list:
    """Hit Gemini API directly using HTTP POST."""
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TEXT_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": SYSTEM_INSTRUCTION},
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json"
        }
    }
    
    with httpx.Client(timeout=90) as client:
        resp = client.post(api_url, json=payload)
        resp.raise_for_status()
        res_json = resp.json()
        
    text = res_json["candidates"][0]["content"]["parts"][0]["text"]
    
    # Strip markdown fences if present
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    
    return json.loads(text.strip())


def call_gemini_with_retry(prompt: str, max_retries: int = 3, initial_delay: int = 3) -> list:
    """Call Gemini API with retries and exponential backoff."""
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            return call_gemini_api(prompt)
        except Exception as e:
            print(f"   ⚠️ Gemini API call failed (Attempt {attempt+1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                raise e
            print(f"      Waiting {delay} seconds before retrying...")
            time.sleep(delay)
            delay *= 2
    return []


def load_sorted_nutrition_refs(ref_to_products: dict, ref_counts: dict) -> list:
    """Load nutrition_ref items and sort them by MBG product frequency."""
    print("📥 Loading nutrition_ref items and sorting by MBG frequency...")
    resp = supabase.table("nutrition_ref") \
        .select("id, name, kategori") \
        .order("id") \
        .execute()
    all_items = resp.data or []
    for item in all_items:
        item_id = item.get("id")
        item["frequency"] = ref_counts.get(item_id, 0)
    sorted_items = sorted(all_items, key=lambda x: (-x.get("frequency", 0), x.get("id", 0)))
    return sorted_items


def run_mapping_agent():
    print("=" * 80)
    print("🚀 STARTING SCHEMA-DIRECT AI MAPPING AGENT")
    print("=" * 80)
    print(f"🤖 AI Model: {GEMINI_TEXT_MODEL}")
    print(f"🗄️ Supabase URL: {SUPABASE_URL}")
    print()

    # Load active products context
    ref_to_products, ref_counts = get_products_with_nutrition()
    all_tkpi_data = load_sorted_nutrition_refs(ref_to_products, ref_counts)

    # Paging nutrition_ref
    limit = 100
    offset = 0
    total_processed = 0
    total_units_saved = 0
    total_aliases_saved = 0

    print(f"\n📦 Total nutrition_ref rows loaded: {len(all_tkpi_data)}")
    print(f"   Rows with MBG product links: {sum(1 for item in all_tkpi_data if item.get('frequency', 0) > 0)}")

    while offset < len(all_tkpi_data):
        batch_data = all_tkpi_data[offset:offset + limit]
        print(f"\n📦 [BATCH] Processing batch {offset // limit + 1} - rows {offset} to {offset + len(batch_data) - 1}")
        
        try:
            if not batch_data:
                break
            
            print(f"   Loaded {len(batch_data)} ingredients from local batch.")
            tkpi_inputs = [
                {
                    "id": item["id"],
                    "name": item["name"],
                    "kategori": item.get("kategori", ""),
                    "mbg_product_count": item.get("frequency", 0)
                }
                for item in batch_data
            ]
            
            # Build prompt
            prompt = (
                "Berikut adalah BATCH data referensi TKPI yang harus diproses. "
                "Data sudah diurutkan berdasarkan frekuensi kemunculan di produk katering MBG. "
                f"Jika nama bahan ini muncul lebih banyak di produk, utamakan rekomendasi grouping dan sinonim pasar yang relevan.\n"
                f"{json.dumps(tkpi_inputs, indent=2, ensure_ascii=False)}"
            )
            
            # Call Gemini
            print("   🧠 Sending batch to Gemini for unit weights and keyword analysis...")
            mapped_results = call_gemini_with_retry(prompt)
            
            if mapped_results:
                print(f"   ✅ Gemini parsed {len(mapped_results)} relevant entries in this batch.")
                batch_lookup = {int(x["id"]): x for x in batch_data}

                for item in mapped_results:
                    ref_id = item.get("id_nutrition_ref")
                    conversions = item.get("konversi_satuan") or []
                    keywords = item.get("keyword_nota") or item.get("keywords_slang") or []
                    kategori_induk = item.get("kategori_induk") or ""
                    nama_tkpi = item.get("nama_tkpi") or batch_lookup.get(int(ref_id), {}).get("name", "")
                    nama_bersih = item.get("nama_bersih") or nama_tkpi
                    kondisi = item.get("kondisi") or ""

                    if not ref_id:
                        continue

                    try:
                        mapping_payload = {
                            "nutrition_ref_id": int(ref_id),
                            "nama_tkpi": nama_tkpi,
                            "nama_bersih": nama_bersih,
                            "kondisi": kondisi,
                            "kategori_induk": kategori_induk,
                            "keyword_nota": keywords,
                            "konversi_satuan": conversions,
                            "source": "ai_agent"
                        }
                        supabase.table("ingredient_mapping").upsert(mapping_payload, on_conflict="nutrition_ref_id").execute()
                    except Exception:
                        pass

                    try:
                        master_res = supabase.table("master_ingredients").select("id").eq("nutrition_ref_id", int(ref_id)).execute()
                        if master_res.data:
                            ingredient_uuid = master_res.data[0]["id"]
                        else:
                            orig_item = batch_lookup.get(int(ref_id))
                            ref_name = orig_item["name"] if orig_item else nama_tkpi or "Bahan Baku"
                            ref_cat = kategori_induk or (orig_item.get("kategori") if orig_item else "lainnya") or "lainnya"
                            slug = re.sub(r"[^a-z0-9]+", "-", ref_name.lower()).strip("-")
                            new_master = {
                                "common_name": ref_name,
                                "nutrition_ref_id": int(ref_id),
                                "category": ref_cat.strip().lower(),
                                "is_primary": True,
                                "is_active": True,
                                "slug": slug,
                                "aliases": keywords
                            }
                            ins_res = supabase.table("master_ingredients").insert(new_master).execute()
                            if not ins_res.data:
                                print(f"      ⚠️ Gagal membuat master_ingredient baru untuk TKPI {ref_id}")
                                continue
                            ingredient_uuid = ins_res.data[0]["id"]
                            print(f"      🆕 Auto-created master_ingredient: {ref_name} (UUID: {ingredient_uuid})")
                    except Exception as e:
                        print(f"      ⚠️ Failed to fetch/create master_ingredient for TKPI {ref_id}: {e}")
                        continue

                    for conv in conversions:
                        unit = conv.get("satuan", "").strip().lower()
                        weight = conv.get("berat_gram", 0)
                        if unit and weight > 0:
                            try:
                                payload = {
                                    "ingredient_id": ingredient_uuid,
                                    "unit": unit,
                                    "weight_gram": float(weight),
                                    "source": "ai_agent"
                                }
                                supabase.table("ingredient_unit_weights").upsert(payload, on_conflict="ingredient_id, unit").execute()
                                total_units_saved += 1
                            except Exception as e:
                                print(f"      ⚠️ Gagal upsert unit weight ({unit} -> {weight}g): {e}")

                    for keyword in keywords:
                        clean_keyword = keyword.strip().lower()
                        if clean_keyword:
                            try:
                                payload = {
                                    "slang_name": clean_keyword,
                                    "nutrition_ref_id": ref_id
                                }
                                supabase.table("nutrition_aliases").upsert(payload, on_conflict="slang_name").execute()
                            except Exception:
                                pass

                    matched_products = ref_to_products.get(ref_id) or []
                    for product in matched_products:
                        for keyword in keywords:
                            clean_keyword = keyword.strip().lower()
                            if clean_keyword:
                                try:
                                    payload = {
                                        "tenant_id": product["tenant_id"],
                                        "product_id": product["id"],
                                        "alias_name": clean_keyword,
                                        "source": "ai",
                                        "confidence": 0.90,
                                        "packaging_value": 1.0,
                                        "packaging_unit": "pcs"
                                    }
                                    supabase.table("product_aliases").upsert(payload, on_conflict="tenant_id, alias_name").execute()
                                    total_aliases_saved += 1
                                except Exception as e:
                                    print(f"      ⚠️ Gagal upsert product alias ({clean_keyword}): {e}")

                print(f"   💾 Batch results written. Running total: {total_units_saved} units, {total_aliases_saved} product aliases.")
            else:
                print("   ⚠️ Gemini returned empty results in this batch.")

            offset += limit
            total_processed += len(batch_data)
            time.sleep(2)  # Respect rate limits

        except Exception as batch_err:
            print(f"❌ ERROR during batch processing (offset {offset}): {batch_err}")
            offset += limit
            time.sleep(5)

    print("\n" + "=" * 80)
    print("🎉 AI AGENT RUN COMPLETED")
    print("=" * 80)
    print(f"📊 Summary:")
    print(f"   Total TKPI rows scanned: {total_processed:,}")
    print(f"   Total unit weight mappings created/updated (Referensi Satuan): {total_units_saved:,}")
    print(f"   Total product aliases created/updated (Mapping Bahan): {total_aliases_saved:,}")
    print("=" * 80)
    print()


if __name__ == "__main__":
    run_mapping_agent()
